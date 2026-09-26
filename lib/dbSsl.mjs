import awsSsl from 'aws-ssl-profiles';

// VOICE_DB_SSL:
//   rds   -> encrypted and verified against Amazon RDS's certificate authorities (use this for AWS RDS)
//   true  -> encrypted and verified against the standard public CAs
//   false -> no encryption
// VOICE_DB_SSL_REJECT_UNAUTHORIZED=false encrypts without verifying the certificate (last resort only).
export function sslOptions(env = process.env) {
  const mode = String(env.VOICE_DB_SSL || 'false').toLowerCase();
  if (mode === 'false' || mode === '') return undefined;
  const verify = env.VOICE_DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  return mode === 'rds' ? { ca: awsSsl.ca, rejectUnauthorized: verify } : { rejectUnauthorized: verify };
}
