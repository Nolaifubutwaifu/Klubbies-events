# Reply to App Review: Guideline 2.1, face data (submission 9dc69e8e)

Paste everything below the line into App Store Connect, Reply to App Review. Checked against the code and the live https://events.klubbies.app/privacy on 25 Nov 2026.

**Before sending:** turn on the AWS AI services opt-out for Rekognition (AWS Organizations, Policies, AI services opt-out policies, attach `{"services":{"rekognition":{"opt_out_policy":{"@@assign":"optOut"}}}}` to the root). Unless you opt out, AWS Service Terms let Rekognition keep images to improve its own models, possibly outside Sydney, and then "Neither may use the data for its own purposes" and "never copied anywhere else" would be untrue. No record of this opt-out was found in the repo.

---

Hello, thank you for the review. Answers to each question below.

1. WHAT FACE DATA THE APP COLLECTS

Klubbies Events is a private photo gallery for events. Its optional "Your photos" feature (labelled "Find my photos") shows an attendee the photos they appear in. When the event's organiser has this feature on:
- Each face in the event's photos is converted into a faceprint (a numeric face vector) by Amazon Rekognition.
- If an attendee chooses to use the feature, they take one selfie. We store that selfie and create a faceprint from it, only after they tick an explicit consent box on the selfie screen.
- When an attendee confirms a match ("This is me"), that face is added as a reference faceprint for them.

The app does not use ARKit, the TrueDepth camera, Face ID or the Vision framework. No face data is collected on the device. The camera is used only when the user takes the selfie themselves.

2. USE, SHARING, RETENTION, DELETION AND STORAGE

Consent: before an attendee sees any photos of a face-search event, the app shows a notice that faces in the photos are analysed and stored with Amazon Web Services in Sydney, and asks them to acknowledge it. Being matched is a separate, optional step: the selfie screen explains what a faceprint is, how it is used and how to delete it, and nothing is uploaded until the user ticks "I consent to Klubbies Events sending my selfie to Amazon Web Services in Sydney to create and store a faceprint from it, so it can be matched against faces in this event's photos." Each consent is stored with its wording version and time. Organisers must also accept a notice before turning the feature on for their event.

Use: only to show each attendee the photos they appear in. Only that attendee sees their own matches. There is no feature that searches photos for a person, for attendees, organisers or our staff. Face data is not used for advertising, profiling, tracking or model training, and is not sold.

Storage: faceprints are stored in Amazon Rekognition, AWS region ap-southeast-2 (Sydney, Australia). Selfies are stored in our Supabase storage, also in Sydney (ap-southeast-2), in a private location that organisers cannot access. Selfies and faceprints are never copied anywhere else, including our backups.

Deletion, all automatic:
- User turns face search off ("Turn off face search and delete my face data"): selfie, faceprints and matches are deleted immediately, at most within 24 hours.
- User deletes their account (in the app, Profile, Delete my account): selfie and faceprints are deleted from AWS immediately, before the account itself.
- Organiser turns the feature off: every faceprint for the event is deleted.
- A photo is deleted: the faceprints made from it are deleted.
- The event's gallery closes (at most 12 months after the event): all of the event's selfies and face data are deleted within 24 hours.

3. THIRD PARTIES AND LOCATION

Face data is not shared with any third party apart from the processors that run the service for us: Amazon Web Services (Rekognition, Sydney), which creates and stores faceprints, and Supabase (Sydney), which stores the selfie image. Neither may use the data for its own purposes. Nothing is sold or shared with anyone else.

4. HOW LONG IT IS KEPT

Only as long as the feature is in use for that event: until the user turns it off, deletes their account, the organiser turns it off, the photo is deleted, or the gallery closes, whichever comes first. The longest possible retention is 12 months after the event.

5. WHERE IN THE PRIVACY POLICY

https://events.klubbies.app/privacy, sections "Face search: what we collect", "Face search: what we use it for", "Face search: how long we keep it", "Face search: who else sees it", "Where data lives", "How long galleries stay open" and "Deleting your account". A plain-language summary is at https://events.klubbies.app/face-search-privacy.

6. QUOTED TEXT

"Face search: what we collect": "When an event has face search on, we send that event's photos to Amazon Rekognition, operated by Amazon Web Services in Sydney, Australia. Rekognition finds faces and creates a faceprint, a mathematical description of a face, for each one. This happens for every face in the photo, including people who never open the gallery. If you choose to add a selfie, we also create a faceprint from it and store the selfie. A faceprint is biometric information, which is sensitive information under the Privacy Act 1988. We only create one from your selfie with your express consent, given on the selfie screen, and you can withdraw it at any time."

"Face search: what we use it for": "To show you the photos you appear in. Nothing else. Only you can see your own matches. There is no feature that searches an event's photos for a particular person, for attendees, for organisers or for our own staff, and we have not built one."

"Face search: how long we keep it": "A faceprint made from a photo is deleted when that photo is deleted for good. [...] Your selfie and the faceprint made from it are deleted when you turn face search off, when your access to the event ends, or when the organiser turns the feature off: within 24 hours in each case. When an organiser turns it off, every faceprint for that event is deleted."

"Face search: who else sees it": "Amazon Web Services processes faceprints on our behalf, in the ap-southeast-2 (Sydney) region. We do not sell face data and we do not share it with anyone else."

"Where data lives": "Selfies and faceprints are never copied: they stay in Sydney."

"How long galleries stay open": "When a gallery closes, attendees' selfies and all of the event's face search data are deleted within 24 hours."

"Deleting your account": "That deletes your sign-in, your profile and photo, your saved photos, your face search selfie and faceprints, and your notification device tokens, straight away."

Happy to answer anything else.
