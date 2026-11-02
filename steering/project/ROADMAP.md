# Roadmap

The goals of tumach-dance and their features: done (`[x]`) or missing (`[ ]`). The `roadmap` skill makes the next epic from a missing feature.

## 1. Show the studio

- [x] `site:skeleton` (#2) The current home page of tumach.dance as a Next.js site, live on a preview address
  - The home page has the look ("simple and chill") and the layout of the current site, on a phone and a laptop; its texts are placeholders until Nina gives the real ones
  - Each merge to main updates the preview site on the home server, with no step by Lars (after one setup)
  - `npm run dev` starts the site on the owner's computer (`/try`)
- [ ] `site:languages` English and Dutch
  - A visitor selects the language on each page; the first visit uses the language of the browser
  - Each text is in a data file per language; a missing text shows the English text
- [x] `site:schedule` (#94) The classes and the weekly schedule come from data that Nina changes
  - Nina changes a class or a time on her phone, and the site shows it at once
- [ ] `site:contact` The contact form sends the message to Nina's email (Mailgun)
  - A visitor sends a message; Nina gets it in her Gmail and replies to the visitor
  - The form stops spam bots with no puzzle for the visitor
- [ ] `site:photos` Photos of the studio that Nina adds from her phone
  - Nina adds or removes a photo in a few taps; the site shows the photos fast on a phone
- [x] `site:findable` (#237) Search engines and link previews find and show the site
  - A shared link shows a picture and a short text in WhatsApp and Instagram
  - Google finds each page in each language
- [x] `site:texts` (#257) Real texts on each public page, in each language
  - An agent writes a sensible text for each section; Nina gives only her tagline (owner, 2026-10-31)
  - No page shows a placeholder
- [ ] `site:where` Dancers know where the studio is
  - The home page, the emails of an approved booking and the calendar file of a booking give the address, in the places that Nina chooses; a page has a link that opens the map on the phone
- [x] `site:access` (#339) Each visitor can read the site and book, also with a screen reader, a large text or only the keyboard
  - Each page of the site and of the studio app has no serious barrier (a check with axe)
  - A dancer books a lesson with only the keyboard
- [ ] `site:lost` A visitor who opens a wrong or old address, or meets an error, finds the way back
  - An unknown address shows a page in the look and the language of the site, with links to the home page and to the booking page; the studio app has the same
  - An error of a page shows a calm page with "Try again", not the bare error page
- [ ] `site:live` tumach.dance runs the new site
  - Each merge to main updates the live site, as the preview (one image, owner 2026-10-31); the live site and the preview have separate data
  - A backup of the data each night, and a tested way to restore it
- [ ] `site:watch` Lars knows when the live site has a problem
  - Lars gets a message when the live site stops or the nightly backup fails, with no paid service

## 2. Nina's studio app

- [x] `nina:app` (#11) Nina's login, the app on her phone and push notifications
  - Only Nina logs in, on her phone and her laptop, and stays logged in on each device
  - Nina adds the app to the home screen of her phone and gets a test notification
  - A short guide in her language shows each step, with pictures
- [x] `nina:review` (#65) A page "For Nina" on the preview site with each question of the agents for her
  - Each question says in plain words what to try, with a link to the page, choices and a text box
  - Her answer goes to the ticket, and the next run continues with it; technical questions go to Lars only
  - A new question gives a push notification on her phone
- [x] `nina:hours` (#15) The open hours with simple rules
  - Nina sets "weekends all day, weekdays from 17:00, not on Thursday" in a few taps
  - Nina closes a date or a period (a holiday) and opens an extra day
  - The times stay correct at the change to and from summer time
- [x] `nina:offers` (#29) Private lessons and studio rental, each with a length and a price
  - Nina adds, changes or hides an offer; dancers see only the visible offers
- [x] `nina:overview` (#100) All bookings at a glance
  - Nina sees the requests, the approved and the paid bookings per day and per week
  - The calendar on her phone shows the bookings (a calendar feed)
- [ ] `nina:block` Nina keeps a time free of bookings from the site
  - Nina blocks a time on one day in a few taps (a lesson that she gave by WhatsApp or phone, or time for herself); the booking page no longer offers it
  - Nina removes the block, and the time is free again

## 3. Book a lesson or the studio

- [ ] `book:request` A dancer picks a free timeslot and sends a request
  - A dancer selects a private lesson or studio rental, sees only the free slots, and sends a request with a name, an email and a phone number (no account)
  - The dancer gets an email in the language of the site that the request is in
  - Two dancers never get the same slot: an open request holds its slot until Nina decides
- [x] `book:decide` (#73) Nina approves or declines each request
  - Nina gets a push notification for each new request and approves or declines it with one tap
  - The dancer gets an email with the decision
- [ ] `book:pay` A payment link after the approval
  - The approval email has a payment link (iDEAL)
  - Nina sees which bookings are paid; a dancer who did not pay gets one reminder
- [ ] `book:change` Cancel and remind
  - The dancer cancels with a link in the email, by the cancel rules; Nina cancels from her app
  - The dancer gets a reminder the day before, with a calendar file
- [ ] `book:unanswered` A request that Nina does not answer in time
  - A request with no answer at its start ends by itself; the dancer gets one email with a link to book another time
  - Nina never approves or declines a request whose time has started
- [x] `book:privacy` (#222) The data of the dancers is safe
  - A privacy page says what the studio keeps and for how long; old data goes away
- [ ] `book:forget` Nina removes the data of a dancer who asks for it
  - From one booking in her app, Nina removes the name, email and phone of each booking of that dancer in two taps; a coming booking is cancelled first, with the usual email
