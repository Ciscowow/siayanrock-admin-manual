import { useState } from 'react'
import { BedDouble, FileText, MoreHorizontal, Search, Users, Wrench, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { formatCurrency, toDateKey } from '../shared'
import type { Booking, Room, RoomEditValues } from '../types'
import './css/hometel-rooms.css'

export function RoomsPage({ rooms, bookings, occupiedRoomIds, dataLoading, query, setQuery, onUpdateRoom, onSetMaintenance, updatingRoomId, error }: {
  rooms: Room[]
  bookings: Booking[]
  occupiedRoomIds: Set<number>
  dataLoading: boolean
  query: string
  setQuery: (value: string) => void
  onUpdateRoom: (room: Room, values: RoomEditValues) => Promise<boolean>
  onSetMaintenance: (room: Room, enabled: boolean, note: string) => Promise<boolean>
  updatingRoomId: string | null
  error: string
}) {
  const [openMenuRoomId, setOpenMenuRoomId] = useState<string | null>(null)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [editValues, setEditValues] = useState<RoomEditValues>({ name: '', type: '', rate: '', capacity: '', notes: '' })
  const [maintenanceRoom, setMaintenanceRoom] = useState<Room | null>(null)
  const [maintenanceNote, setMaintenanceNote] = useState('')
  const todayKey = toDateKey(new Date())
  const getCurrentBooking = (room: Room) => bookings.find((booking) =>
    booking.roomId === Number(room.id) &&
    (booking.status === 'Confirmed' || booking.status === 'Checked in') &&
    booking.checkIn <= todayKey &&
    booking.checkOut > todayKey,
  )
  const filteredRooms = rooms
    .filter((room) => `${room.roomNumber} ${room.name} ${getCurrentBooking(room)?.guest ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((left, right) => Number(left.id) - Number(right.id))
  const occupied = rooms.filter((room) => room.isActive && occupiedRoomIds.has(Number(room.id))).length
  const vacant = rooms.filter((room) => room.isActive && !occupiedRoomIds.has(Number(room.id))).length
  const saveRoom = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingRoom) return
    const saved = await onUpdateRoom(editingRoom, editValues)
    if (saved) setEditingRoom(null)
  }
  const updateMaintenance = async () => {
    if (!maintenanceRoom) return
    const saved = await onSetMaintenance(maintenanceRoom, !maintenanceRoom.isUnderMaintenance, maintenanceNote)
    if (saved) setMaintenanceRoom(null)
  }

  return <>
    <div className="page-heading"><div><p className="eyebrow">Hometel</p><h1>Rooms</h1><p className="subtitle">Room inventory, occupancy, and maintenance.</p></div></div>
    <div className="room-summary room-summary-two">
      <div><span className="summary-dot occupied-dot" /><strong>{dataLoading ? '—' : occupied}</strong><span>Occupied</span></div>
      <div><span className="summary-dot available-dot" /><strong>{dataLoading ? '—' : vacant}</strong><span>Vacant</span></div>
    </div>
    <section className="card rooms-card">
      <div className="filter-bar"><div className="search-box"><Search size={17} /><input placeholder="Search rooms or guests..." value={query} onChange={(event) => setQuery(event.target.value)} /></div></div>
      {error && <div className="room-status-error" role="alert">{error}</div>}
      <div className="room-grid">
        {filteredRooms.map((room) => {
          const currentBooking = getCurrentBooking(room)
          const roomNumber = room.roomNumber.trim() || room.id
          const isOccupied = occupiedRoomIds.has(Number(room.id))
          const status = dataLoading ? 'checking' : room.isUnderMaintenance ? 'maintenance' : !room.isActive ? 'inactive' : isOccupied ? 'occupied' : 'vacant'
          const roomFolder = room.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
          const image = roomFolder
            ? supabase.storage.from('gallery').getPublicUrl(`rooms/${roomFolder}/${roomFolder}-1.webp`).data.publicUrl
            : ''
          return <article className={`room-tile ${isOccupied ? 'room-tile-occupied' : ''} ${room.isUnderMaintenance ? 'room-tile-maintenance' : ''}`} key={room.id}>
            <div className="room-image">
              <BedDouble className="room-image-fallback" size={28} />
              {image && <img className="room-photo" src={image} alt={`${room.name} room`} onError={(event) => { event.currentTarget.style.display = 'none' }} />}
              <span className={`room-status status-${status}`}>{status === 'checking' ? 'Checking...' : status === 'maintenance' ? 'Maintenance' : status === 'inactive' ? 'Inactive' : status === 'occupied' ? 'Occupied' : 'Vacant'}</span>
              <div className="room-menu-container">
                <button className="room-menu" aria-label={`More actions for ${room.name}`} aria-expanded={openMenuRoomId === room.id} disabled={dataLoading || Boolean(updatingRoomId)} onClick={() => setOpenMenuRoomId(openMenuRoomId === room.id ? null : room.id)}><MoreHorizontal size={17} /></button>
                {openMenuRoomId === room.id && <div className="room-menu-dropdown" role="menu">
                  <button role="menuitem" onClick={() => {
                    setEditValues({ name: room.name, type: room.type, rate: String(room.rate), capacity: String(room.capacity), notes: room.notes })
                    setEditingRoom(room)
                    setOpenMenuRoomId(null)
                  }}><FileText size={14} /> Edit room</button>
                  <button role="menuitem" disabled={(Boolean(currentBooking) && !room.isUnderMaintenance) || (!room.isActive && !room.isUnderMaintenance)} title={currentBooking && !room.isUnderMaintenance ? 'A guest is currently checked in.' : !room.isActive && !room.isUnderMaintenance ? 'This room is already offline.' : undefined} onClick={() => {
                    setMaintenanceRoom(room)
                    setMaintenanceNote(room.maintenanceNote)
                    setOpenMenuRoomId(null)
                  }}><Wrench size={14} /> {room.isUnderMaintenance ? 'End maintenance' : 'Set for maintenance'}</button>
                </div>}
              </div>
            </div>
            <div className="room-tile-body">
              <div className="room-title"><div><span className="room-number">Room {roomNumber}</span><h2>{room.name}</h2></div><span className="room-type">{room.type}</span></div>
              <div className="room-meta"><span><Users size={13} /> Up to {room.capacity}</span><strong>{formatCurrency(room.rate)} <small>/ night</small></strong></div>
              {currentBooking && <div className="room-card-current-guest"><small>Current guest</small><strong>{currentBooking.guest}</strong></div>}
              {room.isUnderMaintenance && room.maintenanceNote && <div className="room-card-current-guest"><small>Maintenance note</small><strong>{room.maintenanceNote}</strong></div>}
            </div>
          </article>
        })}
      </div>
      {filteredRooms.length === 0 && <div className="empty-state"><BedDouble size={25} /><strong>No rooms found</strong><span>Try a different room number or guest name.</span></div>}
    </section>
    {editingRoom && <div className="assignment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !updatingRoomId) setEditingRoom(null) }}>
      <section className="assignment-dialog card room-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-room-title">
        <header className="assignment-header"><div><p className="eyebrow">Room inventory</p><h2 id="edit-room-title">Edit {editingRoom.name}</h2><p className="subtitle">Changes update this room’s details in the booking system.</p></div><button className="icon-button" onClick={() => setEditingRoom(null)} aria-label="Close room editor" disabled={Boolean(updatingRoomId)}><X size={19} /></button></header>
        <form className="room-editor-form" onSubmit={saveRoom}>
          <label>Room name<input required maxLength={80} value={editValues.name} onChange={(event) => setEditValues({ ...editValues, name: event.target.value })} /></label>
          <label>Room type<input required maxLength={80} value={editValues.type} onChange={(event) => setEditValues({ ...editValues, type: event.target.value })} /></label>
          <div className="room-editor-row">
            <label>Price per night<input required type="number" min="0" step="0.01" value={editValues.rate} onChange={(event) => setEditValues({ ...editValues, rate: event.target.value })} /></label>
            <label>Guest capacity<input required type="number" min="1" step="1" value={editValues.capacity} onChange={(event) => setEditValues({ ...editValues, capacity: event.target.value })} /></label>
          </div>
          <label>Description<textarea rows={3} maxLength={1000} value={editValues.notes} onChange={(event) => setEditValues({ ...editValues, notes: event.target.value })} /></label>
          <footer className="assignment-actions"><button className="button button-secondary" type="button" onClick={() => setEditingRoom(null)} disabled={Boolean(updatingRoomId)}>Cancel</button><button className="button button-primary" type="submit" disabled={Boolean(updatingRoomId)}>{updatingRoomId === editingRoom.id ? 'Saving…' : 'Save changes'}</button></footer>
        </form>
      </section>
    </div>}
    {maintenanceRoom && <div className="assignment-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !updatingRoomId) setMaintenanceRoom(null) }}>
      <section className="assignment-dialog card room-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="room-maintenance-title">
        <header className="assignment-header"><div><p className="eyebrow">Room availability</p><h2 id="room-maintenance-title">{maintenanceRoom.isUnderMaintenance ? 'End maintenance?' : 'Set room for maintenance?'}</h2><p className="subtitle">{maintenanceRoom.isUnderMaintenance ? `${maintenanceRoom.name} will become bookable again.` : `${maintenanceRoom.name} will be removed from new bookings until maintenance is ended. Existing bookings are not changed.`}</p></div><button className="icon-button" onClick={() => setMaintenanceRoom(null)} aria-label="Close maintenance dialog" disabled={Boolean(updatingRoomId)}><X size={19} /></button></header>
        {!maintenanceRoom.isUnderMaintenance && <label className="room-maintenance-field">Reason or staff note (optional)<textarea rows={3} maxLength={300} value={maintenanceNote} onChange={(event) => setMaintenanceNote(event.target.value)} placeholder="For example, deep cleaning or air-conditioner repair." /></label>}
        {maintenanceRoom.isUnderMaintenance && maintenanceRoom.maintenanceNote && <p className="room-maintenance-current-note">Current note: {maintenanceRoom.maintenanceNote}</p>}
        <footer className="assignment-actions"><button className="button button-secondary" onClick={() => setMaintenanceRoom(null)} disabled={Boolean(updatingRoomId)}>Cancel</button><button className="button button-primary" onClick={() => void updateMaintenance()} disabled={Boolean(updatingRoomId)}>{updatingRoomId === maintenanceRoom.id ? 'Saving…' : maintenanceRoom.isUnderMaintenance ? 'End maintenance' : 'Confirm maintenance'}</button></footer>
      </section>
    </div>}
  </>
}
