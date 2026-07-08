# Testing Guide: Reserver Pays Full Court Fee

This document covers manual testing steps for the business rule change where **the member who creates a reservation is solely responsible for the full court fee** (base fee for all booked hours + all guest fees + tennis balls). Other members in the reservation owe nothing.

## What Changed

- **Backend**: `reservationController.ts` now creates exactly one pending `Payment` (for the reserver, covering the full fee) on create/update/join/leave — not one per member.
- **Backend**: `paymentController.ts` no longer supports multi-member "pay for others" payments; the `payOnBehalf` endpoint and `/api/payments/pay-on-behalf` route were removed.
- **Frontend**: "Pay for Others" and "Pay on Behalf" UI removed from the Payments page. Booking form and My Reservations now show a single "payable by reserver" summary instead of a per-player fee split.
- **Reports**: Homeowner Distribution and Court Usage reports now attribute the full fee/usage to the reserver only (no code change needed — they aggregate by Payment record).
- **Out of scope**: The Admin Manual Court Usage tool still splits fees equally with per-player override, unchanged.

## Setup

Start both servers:
```bash
npm run dev
```
(or `cd backend && npm run dev` and `cd frontend && ng serve` in separate terminals)

Use two browser sessions (or one normal + one incognito) so you can be logged in as two different users at once. See `TEST_CREDENTIALS.md` for all accounts.

- **Session A** — `RoelSundiam` / `RT2Tennis` (reserver)
- **Session B** — `testmember` / `pass123` (joining member)
- **Session C** — `superadmin` / `admin123` (admin/reports checks)

---

## Test 1 — New reservation: reserver owes the full fee

1. In Session A, go to **Reservations** and book an available slot. Add `testmember` as a second player, plus a guest (a typed name not tied to an account, so it's treated as a non-member).
2. On the booking form, confirm you see a single **"Payable by: [your name] (you) — full amount"** line instead of a per-player table.
3. Submit. Go to **Payments** in Session A — confirm one pending payment for the full amount (base fee for the slot + ₱70 for the guest).
4. In Session B (`testmember`), go to **Payments** — confirm there is **no** pending payment for this reservation. In **My Reservations**, confirm the card shows "Reserved by Roel Sundiam — no payment required for you".

## Test 2 — Join

1. In Session B, from **My Reservations**, find an open reservation made by someone else and click **Join**.
2. Confirm the join modal no longer mentions "Split among members" — it should say joining is free and the reserver is responsible for the full fee.
3. After joining, confirm in Session A (the reserver) that their pending payment still exists as a single payment for the total fee. Confirm Session B still owes nothing.

## Test 3 — Leave

1. In Session B, leave the reservation joined in Test 2.
2. Confirm the leave modal no longer shows a fee-recalculation warning.
3. Confirm the reserver's single payment is still correct afterward.

## Test 4 — Edit (extend duration / change tennis balls)

1. In Session A, edit the original reservation to add an extra hour or change the tennis balls quantity.
2. Confirm the reserver's payment is replaced by a new single payment matching the updated total fee.

## Test 5 — Cancellation

1. Book a reservation far enough in advance (≥12h) and cancel it normally — confirm the pending payment disappears with no leftover payments for anyone.
2. Book a same-day/late reservation and cancel it late — confirm a ₱100 late-cancellation fee payment is created **only** for the reserver.

## Test 6 — Homeowner waiver + tennis balls

1. Book a reservation with all-homeowner players, ≤6 hours before the slot, and request tennis balls.
2. Confirm the only payment created is for the tennis balls cost, owed by the reserver, and no court fee payment exists.

## Test 7 — Reports (Session C, superadmin)

1. Mark the reserver's payment as paid/recorded (**Admin → Payment Management → Record Payment**).
2. Check **Homeowner Distribution Report** and **Court Usage Report** — confirm the full amount/usage is attributed to the reserver only, with no rows for the other members who played.

## Test 8 — UI sanity for removed features

1. In the Payments page, confirm there's no "Pay for Others" checkbox or "Pay for Others"/"Pay on Behalf" buttons anywhere.
2. Optional: `POST` directly to `/api/payments/pay-on-behalf` (Postman/curl) and confirm it now returns 404.

## Test 9 — Admin Manual Court Usage (should be unaffected)

1. As admin, go to the Manual Court Usage entry tool and confirm it still splits the fee equally across selected players with per-player editable amounts, exactly as before — this tool was intentionally left out of scope.

---

## If Something Fails

- Backend payment-creation logic lives in `backend/src/controllers/reservationController.ts` (`createReserverPayment` helper + 5 call sites: create, update ×2, join, leave).
- Payment endpoint logic lives in `backend/src/controllers/paymentController.ts` (`createPayment`).
- Frontend fee display: `frontend/src/app/components/payments/payments.component.ts`, `frontend/src/app/components/reservations/reservations.component.ts`, `frontend/src/app/components/my-reservations/my-reservations.component.ts`.
