import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/Logo'

const CONTACT = 'hello@moneyplant.online'
const UPDATED = '8 October 2026'

function LegalLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 pt-safe sm:px-6">
        <Logo />
        <nav className="flex gap-4 text-sm text-muted">
          <Link to="/privacy" className="hover:text-fg">
            Privacy
          </Link>
          <Link to="/terms" className="hover:text-fg">
            Terms
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-4 pt-10 pb-20 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-subtle">Last updated {UPDATED}</p>
        <div className="mt-10 space-y-8 leading-relaxed text-muted [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-fg [&_li]:mt-1.5 [&_strong]:text-fg [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
    </div>
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p>
        Recall is a personal memory for things you find on the internet. Your saves are private to you. This policy explains what we
        store, why, and the choices you have.
      </p>

      <section>
        <h2>What we store</h2>
        <ul>
          <li>
            <strong>Account information:</strong> your email address, and optionally your name and profile picture (for example from
            Google sign-in).
          </li>
          <li>
            <strong>Your saves:</strong> the links you save and anything you add to them — notes, tags and collections.
          </li>
          <li>
            <strong>Public previews:</strong> for each saved link, publicly available information such as its title, description,
            thumbnail and author, plus an AI-generated summary, category, tags and a search index (embedding) used to find it later.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To show, organize and search your saves — that is the whole product.</li>
          <li>To sign you in and keep your account secure.</li>
        </ul>
        <p className="mt-3">
          We do <strong>not</strong> sell your data, show you ads, build advertising profiles, or use your saved content to train AI
          models. We do not track the content of your saves or searches for analytics.
        </p>
      </section>

      <section>
        <h2>Google sign-in</h2>
        <p>
          If you sign in with Google, we receive only your basic profile (name, email address and profile picture) to create and identify
          your account. We do not access your Gmail, contacts, Drive or any other Google data. Our use of information received from Google
          APIs adheres to the Google API Services User Data Policy, including its Limited Use requirements.
        </p>
      </section>

      <section>
        <h2>Fetching previews</h2>
        <p>
          When you save a link, our server requests that page’s public preview the same way a link-preview service would. It respects
          each site’s robots.txt rules and never logs in to, or bypasses restrictions on, any platform. If a preview isn’t publicly
          available, the link is still saved with whatever you added.
        </p>
      </section>

      <section>
        <h2>Service providers</h2>
        <p>Recall runs on a small number of providers that process data only to operate the service:</p>
        <ul>
          <li>
            <strong>Supabase</strong> — database, authentication and server functions (where your account and saves are stored).
          </li>
          <li>
            <strong>Vercel</strong> — hosting of the web app.
          </li>
          <li>
            <strong>Groq</strong> — AI processing that writes summaries, categories and tags. It receives a saved link’s public preview
            and your note for that item, only to return those results.
          </li>
        </ul>
      </section>

      <section>
        <h2>Security</h2>
        <p>
          Every saved item is protected by database-level access rules so only your account can read or change it. Connections use
          HTTPS, and server secrets are never sent to your browser.
        </p>
      </section>

      <section>
        <h2>Your choices</h2>
        <ul>
          <li>
            <strong>Export:</strong> download all your saves as JSON or CSV any time from Settings.
          </li>
          <li>
            <strong>Edit or delete:</strong> change or remove any save, note, tag or collection.
          </li>
          <li>
            <strong>Delete your account:</strong> Settings → Privacy → Delete account permanently removes your account and everything in
            it.
          </li>
        </ul>
      </section>

      <section>
        <h2>Children</h2>
        <p>Recall is not intended for children under 13, and we do not knowingly collect their data.</p>
      </section>

      <section>
        <h2>Changes and contact</h2>
        <p>
          If this policy changes in a meaningful way, we’ll update the date above. Questions or requests:{' '}
          <a href={`mailto:${CONTACT}`} className="font-medium text-fg underline underline-offset-2">
            {CONTACT}
          </a>
          .
        </p>
      </section>
    </LegalLayout>
  )
}

export function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p>By creating an account or using Recall, you agree to these terms.</p>

      <section>
        <h2>The service</h2>
        <p>
          Recall lets you save links from the internet, add notes, organize them and find them again. AI-generated summaries, categories
          and tags are provided as a convenience and may be incomplete or inaccurate.
        </p>
      </section>

      <section>
        <h2>Your account</h2>
        <p>
          You’re responsible for keeping your login secure and for activity under your account. You must be at least 13 years old to use
          Recall.
        </p>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You own what you add to Recall. You give us permission to store and process it only to provide the service to you. Saved links
          point to content owned by others; Recall stores a reference and public preview, not a copy of that content, and you should open
          the original to view it.
        </p>
      </section>

      <section>
        <h2>Acceptable use</h2>
        <ul>
          <li>Don’t use Recall to break the law or infringe others’ rights.</li>
          <li>Don’t try to access other people’s data, disrupt the service, or overload it with automated requests.</li>
          <li>Don’t use Recall to get around other platforms’ access restrictions.</li>
        </ul>
      </section>

      <section>
        <h2>Availability</h2>
        <p>
          We work to keep Recall reliable, but it’s provided “as is” without guarantees of uninterrupted availability. Export your data
          any time if you want your own copy. We may change or discontinue features, and will give reasonable notice before shutting the
          service down.
        </p>
      </section>

      <section>
        <h2>Ending your use</h2>
        <p>
          You can delete your account at any time from Settings. We may suspend accounts that violate these terms.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>To the extent permitted by law, Recall is not liable for indirect or consequential losses arising from use of the service.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>
          Questions about these terms:{' '}
          <a href={`mailto:${CONTACT}`} className="font-medium text-fg underline underline-offset-2">
            {CONTACT}
          </a>
          . See also our{' '}
          <Link to="/privacy" className="font-medium text-fg underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </LegalLayout>
  )
}
