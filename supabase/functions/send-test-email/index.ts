Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Use POST" }, { status: 405 });
  }

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    return Response.json({ error: "RESEND_API_KEY is not set" }, { status: 500 });
  }

  let body: { to?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body.to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.to)) {
    return Response.json({ error: "Provide a valid recipient email in `to`" }, { status: 400 });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Test <onboarding@resend.dev>",
      to: [body.to],
      subject: "Resend test",
      html: "<p>Your Resend test email was sent successfully.</p>",
    }),
  });

  const result = await response.json();
  return Response.json(result, { status: response.ok ? 200 : 502 });
});