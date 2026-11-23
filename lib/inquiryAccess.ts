// Who is a "party" to an inquiry. One definition shared by the inquiry list, the edit API and the Synergy screen.
//  - owner     = the creator (created_by_email), by default
//  - handler   = the assigned staff member (staff_email)
//  - consultant = the assigned agent (assigned_agent), who may be staff, administrator or superuser
// Any party may open the inquiry and reassign it (consultant, handler). Superusers and administrators can always do both.

export type InquiryParties = {
  staff_email?: string | null;
  assigned_agent?: string | null;
  created_by_email?: string | null;
};

const lc = (s?: string | null) => (s ?? '').trim().toLowerCase();

export function inquiryRole(
  inq: InquiryParties,
  myEmail?: string | null,
  myAgentCode?: string | null,
): 'owner' | 'handler' | 'consultant' | null {
  const me = lc(myEmail);
  if (me && lc(inq.created_by_email) === me) return 'owner';
  if (me && lc(inq.staff_email) === me) return 'handler';
  if (myAgentCode && inq.assigned_agent && inq.assigned_agent === myAgentCode) return 'consultant';
  return null;
}

export const isInquiryParty = (inq: InquiryParties, myEmail?: string | null, myAgentCode?: string | null) =>
  inquiryRole(inq, myEmail, myAgentCode) !== null;
