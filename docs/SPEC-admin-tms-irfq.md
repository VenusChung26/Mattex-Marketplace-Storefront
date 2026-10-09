# Spec — Sales portal · Create TMS iRFQ

Locked UX for Mattex Sales portal RFQ detail / inbox actions.

## Create

- Trigger: **Create TMS iRFQ** (after Accept; also allowed after Submit To Buyer).
- Method: TMS-integration **server bot** logs into TMS and creates one inbound iRFQ from this marketplace RFQ (lines + optional PDF).
- Assignment: take the signed-in sales account email (not the display name). Look up TMS users where `email` equals that address. That user is `handled_by`. If no TMS user has that email, leave the handler blank. The server bot only logs in.
- Portal TMS password is **not** required to create.

## After iRFQ created (MUST)

1. Save on the RFQ: `tmsId`, `tmsDocumentNo`, details `tmsUrl`.
2. The Create button **becomes** `Open [iRFQ document no.]` (e.g. `Open iRFQ-26000759-01`).
3. Click Open → that iRFQ **details** page, not the inbound list:

`https://uat-tms-v2.mattex.com.hk/inbound/inbound-rfq/{tmsId}`

4. Do not show Create again for an RFQ that already has `tmsDocumentNo`.
