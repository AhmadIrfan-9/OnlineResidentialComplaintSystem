# Registration Form Test Cases

## TC-REG-001: Successful Student Registration

- Objective: Verify a new student can register from the Login page and data is saved according to Prisma schema (`users` + `student_profiles`).
- Priority: High
- Type: Functional (Positive)

### Preconditions

- App is running (`npm run dev`).
- Database connection is active.
- At least one hostel and room exist.
- Test Student ID is not already registered.

### Test Data

- Student ID: `S999001`
- Full Name: `Test Student One`
- Phone: `0123456789`
- Hostel: any existing hostel
- Room: any available room under selected hostel
- Password: `password123`
- Confirm Password: `password123`

### Steps

1. Open `/login`.
2. Click `Register` tab.
3. Fill all required fields with the test data.
4. Click `Register`.
5. Switch to `Login` tab.
6. Enter Student ID `S999001` and Password `password123`.
7. Click `Login`.

### Expected Results

1. Registration shows success message: `Registration successful. You can now log in.`
2. New record exists in `users`:
   - `email = s999001@student.orcs.local`
   - `name = Test Student One`
   - `role = STUDENT`
   - `password` is hashed (not plain text)
3. New record exists in `student_profiles` linked to the new `users.id` with selected `roomId`.
4. Login succeeds and redirects to dashboard route flow (`/dashboard` then student destination).

---

## TC-REG-002: Duplicate Student ID Blocked

- Objective: Verify duplicate Student ID cannot be registered.

### Steps

1. Repeat TC-REG-001 registration using the same Student ID `S999001`.
2. Click `Register`.

### Expected Results

1. Registration fails.
2. Error displayed: `Student ID is already registered`.
3. No duplicate `users` row is created.

---

## TC-REG-003: Password Confirmation Validation

- Objective: Verify mismatch password validation is enforced.

### Steps

1. Open `Register`.
2. Fill valid fields but set:
   - Password: `password123`
   - Confirm Password: `password124`
3. Click `Register`.

### Expected Results

1. Registration blocked.
2. Inline/form error shown: `Passwords do not match`.
3. No user/profile records created.

