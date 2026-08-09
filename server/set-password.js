// Sets or resets the one login, without putting the password anywhere it
// lingers — not in a dashboard variable, not in shell history, not in `ps`.
//
//   node server/set-password.js teeta@example.com
//     → prompts, with the typing hidden
//
//   echo 'the new password' | node server/set-password.js teeta@example.com
//     → reads it from the pipe
//
// The email may be left off if ADMIN_EMAIL is set. Run it from the Railway
// service shell, or locally against the public DATABASE_URL.
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { pool } from './db.js'
import { migrate } from './migrate.js'
import { setUserPassword } from './admin.js'
import { normalizeEmail } from './auth.js'

function readPipedInput() {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (data += chunk))
    // Only the trailing newline the pipe adds — a password may legitimately
    // end in a space, and this is the one place it is typed rather than
    // pasted into a variable.
    process.stdin.on('end', () => resolve(data.replace(/\r?\n$/, '')))
    process.stdin.on('error', reject)
  })
}

function prompt(label) {
  return new Promise((resolve) => {
    process.stdout.write(label)
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    })
    // Swallow the echo so the password does not sit on screen behind her.
    rl._writeToOutput = () => {}
    rl.question('', (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

async function main() {
  const email = normalizeEmail(process.argv[2] || process.env.ADMIN_EMAIL)
  if (!email) {
    console.error('Usage: node server/set-password.js <email>   (or set ADMIN_EMAIL)')
    process.exit(2)
  }

  await migrate()

  const password = process.stdin.isTTY
    ? await prompt(`New password for ${email}: `)
    : await readPipedInput()

  const { created } = await setUserPassword(email, password)
  console.log(`${created ? 'Created' : 'Updated'} the login for ${email}. Sign in with it now.`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
    .then(() => pool.end())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err.message)
      process.exit(1)
    })
}
