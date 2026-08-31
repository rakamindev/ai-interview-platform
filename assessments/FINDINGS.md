## P0 - API - skill_id is empty when adding assignment and vacancy

**Issue:** at assessment_skill.rb `skill_id` is not populated.

**Solutions:**

1. add `before_validation` to populate `skill_id` from `skill_taxonomy.skill_label`, also
2. add email input form on interview page

## P0 - API and Web - fail removing skill to assess at assessments and vacancies page

**Issue:** when admin edit assessment by removing existing skill and adding new skill. then current assessment has two skill two assess, expecting old / existing skill removed.

**Solutions:**
I prefer option 1, because decentralize the lookup load into client side:

1. mark existing skill as delete, along with new skill
2. lookup into table, if skill sent by client isn't available then insert, if available at db only then delete it

## P0 - API and Web - Signup page unavailable

Signup page is available under /web/src/pages/auth/SignupPage. Need to:

1. Add `/signup` into App.tsx
2. Implement backend

## P0 - API and Web - after interview session candidate_id is missing

**Issue:** candidate open assessment interview invitation but after session end candidate_id isn't recorded in table sessions. Neither Manual End by Candidate or Finish interview session candidate_id still null.

**Solutions:**
web sent token using websocket message and decode at api side

## P0 - Web - Cancel confirmation dialog before navigate

**Issue:** stress full when user already type some data, accidently cancel it

**Solutions:**
Add confirmation dialog

## P1 - Web - accessing complete interview session is glitching with "idle" phase

**Issue:** it should idle phase before showing completed phase

**Solutions:**
change initial session session from idle into null

## P2 - Web - accessing invalid invite token still showing complete message

**Issue:** api return 404, but rendered interview complete

**Solutions:**
return error state

## P3 - Web - assessment and vacancy duplicate logic

**Issue:** assessment and vacancy duplicate logic between new and edit page

**Solutions:**
add reusable hooks useAssessment and useVacancy

## P3 - Web - assessment edit and vacancy new edit

**Issue:** Save Changes without Role title not showing error message

**Solutions:**
`register('name'` add show `error.name` message

## P3 - API - Create new admin and user on seed process

**Issue:** at seeds.rb mentioning "After seeding, use the Rails console to mint a JWT for testing:" but there's no insert or User.create.

**Solutions:**
I prefer option 1:

1. Insert both users on seed process, or
2. At very bottom of `seeds.rb` add comment to peform manual insert using console: `User.create!(email: 'admin@example.com', password: '****', role: 'admin')`

# TODO

## P0 - Api - cross organization user

as mentioned at https://github.com/rakamindev/ai-interview-platform/pull/17/changes. but i think organization can be populated with token instead

## P0 - Security - Password sent as plain text

## P0 - Security - application.yml → ALLOWED_ORIGINS: "\*" seems wrong need to allow specific domain instead

## P1 - Api and Web - currently transcript sent by bulk

**Issue:** sent by bulk feel slow and not interactive.

**Solutions:**
better sent it chunk by chunk. already make a changes for it, but experience not good enough. because:

1. sent chunk but repetitive (include previous chunk), work fine on web client side. but seems unnecessary and waste to send repetitive text
2. sent chunk by chunk, but seems odd because adding suffix empty space (text+" ") isn't rendered correctly and inserted correctly into transcript

## P1 - Api and Web - assessments/1/invite → why call sessions every 5s? better use websocket

## P1 - Web - I18n localization based on interview language session

## P2 - Web - unmuteRef seems unnecessary

**Solutions:**
use muteRef instead

## P2 - Web - SignupPage better use react-hook-form for handle email and password

## P3 - Web - Mobile View

## P3 - Web - Edit and Add shared component

**Issue:** Edit add Add has idential UI but have two separate component

**Solutions:**
Combine into AddEdit component, and separate the logic by adding either `isEdit` or `isAdd`
