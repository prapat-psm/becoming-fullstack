# Full-stack learning roadmap

**Audience** — Senior Frontend Engineer with some API experience, targeting Thailand and remote roles open to Thailand-based applicants. Plan for 3–5 hours a week over 18 weeks. The implementation is a reference you can modify and defend in an interview. Capture your own work and evidence as you go.

## Milestones

1. **Weeks 1–4 · Own a vertical slice.** Start with a blank database. Trace `GET /api/rooms` across React, NestJS, and SQL. Add a room-directory change of your own and explain the API contract, migration, CI check, and error states in a short English PR description.
2. **Weeks 5–9 · Own correctness.** Trace session creation and authorization, then walk through the concurrent-booking test. Explain why application-side availability alone cannot guarantee the booking invariant. Add one scenario you came up with and show the test failing before the fix or rule is in place.
3. **Weeks 10–14 · Own operations.** Run `npm run db:explain` on representative seeded data, record row counts and the query plan, and explain the observed index choice. Follow the [runbook](OPERATIONS.md) to rehearse a failed release, recovery, and verification. If an approved demo environment is available, deploy twice and verify rollback there too.
4. **Weeks 15–18 · Show ownership.** Write a one-page English case study and record a 3–5 minute demo. Rehearse discussing ownership, the reservation invariant, and a debugging example. In parallel, look for a bounded API change or cross-team feature in your current job where you can participate in rollout and follow-up.

## Initial market signals

- LINE MAN Wongnai's Bangkok posting joins frontend depth with API integration, tests, deployment, and operating web apps. [Senior Software Engineer, Fullstack](https://careers.lmwn.com/development/1726-software-engineer-full-stack-vuejs)
- BJAK emphasizes shipped work, APIs, data models, auth, and production debugging in a role advertised for Thailand-based remote candidates. [Full Stack Engineer](https://jobs.ashbyhq.com/bjakcareer/33df8f34-bcea-4df7-8e34-2c5c1174933b)
- Remote People's APAC posting demonstrates how React and TypeScript pair with another backend ecosystem, with integration tests and written collaboration. Verify Thailand eligibility during screening. [Full Stack Engineer (APAC)](https://job-boards.greenhouse.io/remotepeople/jobs/5011829101)

Every four weeks, review six distinct roles, aiming for three in Thailand and three remote roles that accept candidates based in Thailand. Record the link, date checked, location eligibility, title, required skills, and one piece of evidence you can show for that role. Mark eligibility as unknown when the employer only says “remote” or “APAC.” Prioritize the next gap that appears across roles you would apply for. Choose a second backend language only once this review or a real project gives you a reason.

## Application evidence

Your case study should cover the problem, what you implemented personally, the most important design decision, which tests verified it, and what happened during the deployment rehearsal. Link the actual CI run and measured query plan when you have them. Keep simulated incidents and demo results labeled. For the walkthrough, spend roughly a minute on the user flow, a minute on the booking race and authorization, and a minute on deployment and debugging.

For the CV, lead with one real Senior Frontend outcome you owned, including the product or user impact you can substantiate. Add Roombook under Projects with a bullet for your own backend contribution and a bullet for delivery or recovery evidence. Use the case study to link the claim to tests, logs, or a demo.

Start with Senior Full Stack roles that value frontend depth and Full-Stack Product Engineer roles where the scope matches your experience. Once you can show delivery and operations, use the [AI career roadmap](AI-CAREER.md) to decide your next direction.
