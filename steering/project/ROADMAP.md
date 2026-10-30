# Roadmap

The goals of tumach-dance and their features: done (`[x]`) or missing (`[ ]`). The `roadmap` skill makes the next epic from a missing feature.

## 1. Show the studio

- [ ] `site:skeleton` The current home page of tumach.dance as a Next.js site, live on a preview address
  - The home page has the look ("simple and chill") and the layout of the current site, on a phone and a laptop; its texts are placeholders until Nina gives the real ones
  - Each merge to main updates the preview site on the home server, with no step by Lars (after one setup)
  - `npm run dev` starts the site on the owner's computer (`/try`)
- [ ] `site:languages` English, Dutch and Slovenian
  - A visitor selects the language on each page; the first visit uses the language of the browser
  - Each text is in a data file per language; a missing text shows the English text
- [ ] `site:schedule` The classes and the weekly schedule come from data that Nina changes
  - Nina changes a class or a time on her phone, and the site shows it at once
- [ ] `site:contact` The contact form sends the message to Nina's email (Mailgun)
  - A visitor sends a message; Nina gets it in her Gmail and replies to the visitor
  - The form stops spam bots with no puzzle for the visitor
- [ ] `site:photos` Photos of the studio that Nina adds from her phone
  - Nina adds or removes a photo in a few taps; the site shows the photos fast on a phone
- [ ] `site:findable` Search engines and link previews find and show the site
  - A shared link shows a picture and a short text in WhatsApp and Instagram
  - Google finds each page in each language
- [ ] `site:live` tumach.dance runs the new site
  - Lars puts a tested version live with one step; the live site and the preview have separate data
  - A backup of the data each night, and a tested way to restore it

## 2. Nina's studio app

- [ ] `nina:app` Nina's login, the app on her phone and push notifications
  - Only Nina logs in, on her phone and her laptop, and stays logged in on each device
  - Nina adds the app to the home screen of her phone and gets a test notification
  - A short guide in her language shows each step, with pictures
- [ ] `nina:review` A page "For Nina" on the preview site with each question of the agents for her
  - Each question says in plain words what to try, with a link to the page, choices and a text box
  - Her answer goes to the ticket, and the next run continues with it; technical questions go to Lars only
  - A new question gives a push notification on her phone
- [ ] `nina:hours` The open hours with simple rules
  - Nina sets "weekends all day, weekdays from 17:00, not on Thursday" in a few taps
  - Nina closes a date or a period (a holiday) and opens an extra day
  - The times stay correct at the change to and from summer time
- [ ] `nina:offers` Private lessons and studio rental, each with a length and a price
  - Nina adds, changes or hides an offer; dancers see only the visible offers
- [ ] `nina:overview` All bookings at a glance
  - Nina sees the requests, the approved and the paid bookings per day and per week
  - The calendar on her phone shows the bookings (a calendar feed)

## 3. Book a lesson or the studio

- [ ] `book:request` A dancer picks a free timeslot and sends a request
  - A dancer selects a private lesson or studio rental, sees only the free slots, and sends a request with a name, an email and a phone number (no account)
  - The dancer gets an email in the language of the site that the request is in
  - Two dancers never get the same slot: an open request holds its slot until Nina decides
- [ ] `book:decide` Nina approves or declines each request
  - Nina gets a push notification for each new request and approves or declines it with one tap
  - The dancer gets an email with the decision
- [ ] `book:pay` A payment link after the approval
  - The approval email has a payment link (iDEAL)
  - Nina sees which bookings are paid; a dancer who did not pay gets one reminder
- [ ] `book:change` Cancel and remind
  - The dancer cancels with a link in the email, by the cancel rules; Nina cancels from her app
  - The dancer gets a reminder the day before, with a calendar file
- [ ] `book:privacy` The data of the dancers is safe
  - A privacy page says what the studio keeps and for how long; old data goes away
