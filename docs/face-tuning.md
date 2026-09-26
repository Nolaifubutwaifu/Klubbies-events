# Tuning photos

Real photos, used once to settle the face recognition thresholds in
`lib/faces/constants.ts`. They go in a `tuning-photos/` folder at the repo
root, which is gitignored so real faces are never committed. Delete the folder
when the tuning run is done.

## Shape

One folder per person, named however you like. A photo goes in a folder for
**every** person it contains, so a group shot of three is copied three times.
That duplication is the point: it is the ground truth that lets the survey
tell a miss from a correct rejection.

    tuning-photos/
      max/            15 photos that contain Max
      sarah/          12 photos that contain Sarah
      liam/            8 photos that contain Liam
      _selfies/       max.jpg, sarah.jpg, liam.jpg — one per person,
                      named to match the folder above

`_selfies/` is what each person "enrols" with, so it should look like a selfie
someone would actually take: face on, reasonably lit, one person in frame. If
you leave it empty the survey picks the sharpest face from each person's own
folder instead, which is a slightly easier test than the real thing.

## What makes a set worth running

Not the count. The same person across **genuinely different shots** — other
lighting, angle, distance, hair, year. A person who appears in only one photo
can never test a miss, which is the thing the 92 threshold controls.

Include the hard ones on purpose: dim rooms, dancefloors, side-on, half-turned,
small in a crowd. A set of clean portraits will report that everything is fine
at 92 when it is not.

Six people with 8–15 photos each is enough for a real answer. Ten is better.

## Before you fill it

These become real faceprints in AWS of people who did not agree to it, which
is the exact thing the club notice warns committees about. Your own photos and
friends who would be fine with it is the clean version; client work is not,
unless you ask them.

The tuning club gets its own Rekognition collection, and deleting it removes
every faceprint in one call. That is the last step of the run.
