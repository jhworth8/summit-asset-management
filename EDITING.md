# Editing the Summit website

Editing works like suggested edits in a shared document:

1. **Dad changes words right on the website** and clicks **Send for review**.
2. **Jesse gets an email**, opens the review screen and sees every change side
   by side: the current wording with removed words struck out, and the
   suggested wording with new words highlighted.
3. Jesse **rejects** anything he doesn't want and clicks **Approve & publish**.
   The public site updates 2 to 3 minutes later.

Nothing reaches the public site until an approver publishes it.

---

## For Dad: changing words

**Your link:** https://jhworth8.github.io/summit-asset-management/?edit
(after the move: https://www.summitassetmanagement.com/?edit)

Bookmark it. After the first time, an **✎ Edit this page** button appears in
the bottom-left corner of every page on your computer, and on no one else's.

1. Open the link. The first time only, type your name and paste your editing
   key, then click **Sign in**.
2. Text you can change has a thin dotted red outline. **Click it and type.**
   Press Enter when you're done with that piece.
3. Changed text turns **yellow**. You can move between pages and keep going;
   your changes are kept.
4. Click **Send for review**. The text turns **blue**: Jesse has it, and it is
   **not on the public website yet**.

- **See what I sent** shows your changes the way Jesse sees them. **Take back**
  removes one.
- **Undo** clears changes you haven't sent yet.
- **Done** stops editing. The ✎ button brings it back.

### Adding a quarterly letter

Click **Add a letter**, type the title as printed on the letter, pick the date,
choose the PDF, and click **Send letter for review**. Once approved, it appears
at the top of Views & News and as the latest letter on the homepage.

---

## For Jesse: reviewing and publishing

When Dad sends changes, GitHub emails you ("Website changes from Dad for
review"). The email has a **Review side by side** link. You can also open
https://jhworth8.github.io/summit-asset-management/?review at any time.

- Each change shows **On the website now** next to **Suggested**, grouped by page.
- **Reject** removes a single change.
- **Approve & publish** (click twice to confirm) puts the rest live.
- **More → Reject all waiting changes** clears everything.

As an approver you can also edit pages yourself and publish directly
(**Save**, then **Review & publish**).

Approvers are listed by GitHub username in
`redesign/public/editor/settings.json`. To let John approve too, add his
username there.

---

## One-time setup (Jesse, about 10 minutes)

Dad needs his own free GitHub login. That's how the site knows his changes
need approval, and how GitHub knows to email you. He never has to look at
GitHub; you set it up once.

**Dad's login and key**

1. Create a GitHub account for him at https://github.com/signup (his email address).
2. Invite him to the project: https://github.com/jhworth8/summit-asset-management/settings/access
   → **Add people** → his username. Accept the invitation from his email.
3. While signed in to **his** account, create his key at
   https://github.com/settings/tokens/new (a "classic" token):
   - Note: `Summit website editor`. Expiration: 1 year.
   - Tick **public_repo** only. Click **Generate token** and copy it.
4. On his computer, open his `?edit` link, enter his name, paste the key and
   click **Sign in**. Bookmark the link.

**Your key**

5. At https://github.com/settings/personal-access-tokens/new create a key on
   **your** account: Repository access **Only select repositories** →
   `summit-asset-management`; permissions **Contents: Read and write** and
   **Pull requests: Read and write**.
6. Open the `?review` link on your computer and sign in with it.

To cut anyone's access, delete their key (or remove Dad from the project).
Every change is recorded with who made it and when.

**Optional: enforce approval on GitHub as well.** The editor already hides
Publish from non-approvers. To make GitHub enforce it too, go to
**Settings → Rules → Rulesets**, add a rule for `main` that requires a pull
request with one approval, and add yourself as a bypass actor so your own
publishing still works.

---

## The full editor (`/admin`)

Open https://jhworth8.github.io/summit-asset-management/admin/, click
**Sign In Using Access Token** and use the same key. Use it for things the
on-page editor doesn't do:

- **Team Bios:** add a person, change photos, hide someone from the site.
- **Firm Details & Documents:** upload a new Form ADV, Form CRS or privacy notice each year.
- **Website Pages:** every page's wording as form boxes, including the title
  and description shown in Google results.

## Before publishing: a compliance reminder

The website is advertising under the SEC Marketing Rule. Have the CCO review
wording before it is published. In particular, avoid:

- performance figures, predictions or anything that sounds like a promise of results;
- testimonials, endorsements, awards or rankings (these need specific disclosures);
- superlatives such as *best*, *highest*, *optimal*, *guarantee*, *ensure*;
- claims about how often something happens (*daily*, *continuously*,
  *always*) unless Form ADV says the same thing.

CONTENT-REVIEW.md lists where every statement on the site comes from.

## If something goes wrong

- **A published change looks wrong:** fix it the same way and publish again.
  Every version is kept in the project history, so any earlier one can be restored.
- **"Your editing key no longer works":** the key expired or was deleted.
  Make a new one (setup above) and sign in again.
- **No email arrived:** check that you're watching the project on GitHub
  (the **Watch** button on the project page), or just open the `?review` link.
- **The site didn't update after publishing:** check
  https://github.com/jhworth8/summit-asset-management/actions. A red ✗ means
  the update was rejected; the error names the problem (most often a letter
  whose PDF is missing).

## For Jesse: editing locally

`npm --prefix redesign run dev`, then open http://localhost:4321/admin/index.html
in Chrome or Edge and choose **Work with Local Repository**. Changes are
written straight to `redesign/src/content/`; commit and push as usual.
