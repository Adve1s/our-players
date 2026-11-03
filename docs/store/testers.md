# Testers

Google needs at least 12 testers opted in continuously for 14 days before a personal account can apply for production (`play-requirements.md`). There's no rush and no session open: add people as you meet them. How to add one is in `release.md` ("Add a tester").

The repo is public, so no tester's name or email ever goes in it. That includes this file.

## Invitation

Add the person's Google-account email to the tester list first. Replace `<opt-in link>` with the link from the console (`release.md` says where), then send the message.

```text
Hi! I've made a small free Android app called Our Players. Each morning it shows how players from the countries you follow did in last night's NHL and NBA games. It starts with Latvia, and you can pick any others.

Before Google lets me release it to everyone, at least 12 people have to test it for 14 days in a row. Would you be one of them? It takes a minute to join, and you only need to open it now and then.

1. On your Android phone, signed in with the Google account you gave me, open this link and tap to become a tester: <opt-in link>
2. Install the app from Google Play: https://play.google.com/store/apps/details?id=dev.adveis.ourplayers (You can't find it by searching yet. The link only works once you've done step 1.)
3. Stay in the test, please, until I tell you it's done. Google counts 14 days in a row, and leaving early resets your count.
4. Try all of it over the two weeks: check last night's games, open a game's box score and a player's page, change the countries you follow, search for a player, make someone a favorite and hide someone.
5. Tell me what you think: anything broken, confusing or missing. Just reply to this, or write to ourplayers@adveis.dev.

There's no account and no ads. The privacy policy is at https://ourplayers.adveis.dev/privacy

Thank you!
```

## Keeping testers opted in

- **Aim for 15,** so one or two dropping out doesn't start the clock again. The earliest finish is 14 days after the twelfth tester who stays has joined.
- **One reminder around day 7,** for each person. Keep it short:

  ```text
  Thanks for testing Our Players! A quick nudge: if you haven't yet, try opening a player's page or changing the countries you follow, and tell me anything that seemed off. And please stay in the test until I tell you it's done.
  ```

- **Nobody opts out until S15 is done.** Google doesn't say what happens if someone leaves after their 14 days, so keep everyone in until production access is approved. Then thank them and let them know they can leave.
- **Use counts too.** Google sets no minimum, but it asks about usage, and too little can mean more testing.

## Your private notes

Keep these outside the repo, in a note only you can see. S15's production-access answers need them:

- the date Google approved the closed-track release;
- when each person joined;
- any feedback they gave and what you did about it.

Found a bug, or someone reported one? Come back for a normal bug-fix session, then ship it as `release.md` says ("Ship an update"). When 12 or more have been opted in for 14 days in a row, come back and start S15.
