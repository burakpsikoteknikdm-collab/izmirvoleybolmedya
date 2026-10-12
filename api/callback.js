module.exports = async (req, res) => {
  const { code, state } = req.query;
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/oauth_state=([a-f0-9]+)/);
  if (!code || !state || !m || m[1] !== state) {
    res.status(400).send('Geçersiz istek');
    return;
  }

  const r = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    })
  });
  const data = await r.json();

  const message = data.access_token
    ? 'authorization:github:success:' + JSON.stringify({ token: data.access_token, provider: 'github' })
    : 'authorization:github:error:' + JSON.stringify(data);
  const safeMessage = JSON.stringify(message).replace(/</g, '\\u003c');

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Set-Cookie', 'oauth_state=; Path=/; Max-Age=0');
  res.status(200).send(`<!doctype html><html><body><script>
(function () {
  var allowed = ['https://www.izmirvoleybolmedya.com', 'https://izmirvoleybolmedya.com'];
  var msg = ${safeMessage};
  function receive(e) {
    if (allowed.indexOf(e.origin) === -1) return;
    window.opener.postMessage(msg, e.origin);
    window.removeEventListener('message', receive, false);
  }
  window.addEventListener('message', receive, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script></body></html>`);
};
