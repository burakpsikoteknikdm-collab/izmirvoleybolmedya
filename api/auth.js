const crypto = require('crypto');

module.exports = (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    scope: 'repo',
    state,
    redirect_uri: 'https://www.izmirvoleybolmedya.com/api/callback'
  });
  res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
  res.writeHead(302, { Location: 'https://github.com/login/oauth/authorize?' + params.toString() });
  res.end();
};
