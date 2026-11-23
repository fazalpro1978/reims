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

// Whether a signed-in user may read or act on one inquiry (server-side check used by the single-inquiry APIs).
//  superuser / administrator : any inquiry
//  staff                     : only inquiries they are a party to (owner, handler or consultant)
//  agent / broker / third_party : only inquiries they are a party to (owner, handler or assigned consultant)
export function canAccessInquiry(
  role: string,
  inq: InquiryParties,
  myEmail?: string | null,
  myAgentCode?: string | null,
): boolean {
  if (role === 'superuser' || role === 'administrator') return true;
  if (role === 'staff') return isInquiryParty(inq, myEmail, myAgentCode);
  if (role === 'agent' || role === 'broker' || role === 'third_party') return isInquiryParty(inq, myEmail, myAgentCode);
  return false;
}

// Whether a user may change who an inquiry is assigned to (consultant and/or handler).
//  superuser / administrator : always
//  staff                     : only as the inquiry owner (creator) or its handler.
//                              The assigned consultant can view and comment but NOT reassign.
//  everyone else             : never
export function canReassignInquiry(
  role: string,
  inq: InquiryParties,
  myEmail?: string | null,
  myAgentCode?: string | null,
): boolean {
  if (role === 'superuser' || role === 'administrator') return true;
  if (role === 'staff') {
    const r = inquiryRole(inq, myEmail, myAgentCode);
    return r === 'owner' || r === 'handler';
  }
  return false;
}

export const REASSIGN_FIELDS = ['assigned_agent', 'staff_email', 'staff_name', 'staff_assigned_at'] as const;
