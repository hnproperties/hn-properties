/**
 * The permission catalogue. Seeded into the database so Super Admin can recombine
 * them per role from Settings; these are the defaults, not the enforcement.
 */
export type PermissionDef = { key: string; group: string; label: string; isDanger?: boolean };

export const PERMISSIONS: PermissionDef[] = [
  // Properties
  { key: 'property.view', group: 'Properties', label: 'View assigned properties' },
  { key: 'property.view.all', group: 'Properties', label: 'View all properties' },
  { key: 'property.create', group: 'Properties', label: 'Add properties' },
  { key: 'property.edit', group: 'Properties', label: 'Edit properties' },
  { key: 'property.delete', group: 'Properties', label: 'Delete properties', isDanger: true },
  { key: 'property.address.view', group: 'Properties', label: 'See exact address and map pin' },
  { key: 'property.private.view', group: 'Properties', label: 'See minimum price, motivation, internal score', isDanger: true },
  { key: 'property.verify', group: 'Properties', label: 'Run HN Verified checks' },
  { key: 'property.publish', group: 'Properties', label: 'Publish and feature listings' },
  { key: 'property.document.view', group: 'Properties', label: 'Open private documents', isDanger: true },
  { key: 'property.document.upload', group: 'Properties', label: 'Upload documents' },
  // Owners
  { key: 'owner.view', group: 'CRM', label: 'View assigned owners' },
  { key: 'owner.view.all', group: 'CRM', label: 'View all owners' },
  { key: 'owner.contact.view', group: 'CRM', label: 'See owner phone and address', isDanger: true },
  { key: 'owner.create', group: 'CRM', label: 'Add owners' },
  { key: 'owner.edit', group: 'CRM', label: 'Edit owners' },
  { key: 'owner.delete', group: 'CRM', label: 'Delete owners', isDanger: true },
  // Clients / requirements / leads
  { key: 'client.view', group: 'CRM', label: 'View assigned clients' },
  { key: 'client.view.all', group: 'CRM', label: 'View all clients' },
  { key: 'client.create', group: 'CRM', label: 'Add clients' },
  { key: 'client.edit', group: 'CRM', label: 'Edit clients' },
  { key: 'client.delete', group: 'CRM', label: 'Delete clients', isDanger: true },
  { key: 'requirement.view', group: 'CRM', label: 'View assigned requirements' },
  { key: 'requirement.view.all', group: 'CRM', label: 'View all requirements' },
  { key: 'requirement.create', group: 'CRM', label: 'Add requirements' },
  { key: 'requirement.edit', group: 'CRM', label: 'Edit requirements' },
  { key: 'requirement.delete', group: 'CRM', label: 'Delete requirements', isDanger: true },
  { key: 'lead.view', group: 'CRM', label: 'View assigned leads' },
  { key: 'lead.view.all', group: 'CRM', label: 'View all leads' },
  { key: 'lead.create', group: 'CRM', label: 'Add leads' },
  { key: 'lead.edit', group: 'CRM', label: 'Edit leads' },
  { key: 'lead.assign', group: 'CRM', label: 'Assign leads to staff' },
  { key: 'lead.delete', group: 'CRM', label: 'Delete leads', isDanger: true },
  // Operations
  { key: 'visit.view', group: 'Operations', label: 'View own site visits' },
  { key: 'visit.view.all', group: 'Operations', label: 'View all site visits' },
  { key: 'visit.create', group: 'Operations', label: 'Schedule site visits' },
  { key: 'visit.edit', group: 'Operations', label: 'Edit site visits' },
  { key: 'visit.delete', group: 'Operations', label: 'Delete site visits', isDanger: true },
  { key: 'deal.view', group: 'Operations', label: 'View own deals' },
  { key: 'deal.view.all', group: 'Operations', label: 'View all deals' },
  { key: 'deal.create', group: 'Operations', label: 'Create deals' },
  { key: 'deal.edit', group: 'Operations', label: 'Edit deals and offers' },
  { key: 'deal.delete', group: 'Operations', label: 'Delete deals', isDanger: true },
  { key: 'deal.commission.view', group: 'Operations', label: 'See commissions and splits', isDanger: true },
  { key: 'deal.payment.manage', group: 'Operations', label: 'Manage payments' },
  // Network
  { key: 'consultant.view', group: 'Network', label: 'View partner consultants' },
  { key: 'consultant.manage', group: 'Network', label: 'Approve and manage consultants' },
  { key: 'collaboration.manage', group: 'Network', label: 'Decide collaboration requests' },
  { key: 'partner.portal', group: 'Network', label: 'Access the partner portal' },
  // System
  { key: 'user.manage', group: 'System', label: 'Manage team accounts' },
  { key: 'role.manage', group: 'System', label: 'Change roles and permissions', isDanger: true },
  { key: 'setting.manage', group: 'System', label: 'Change company settings' },
  { key: 'audit.view', group: 'System', label: 'Read the audit log' },
  { key: 'report.view', group: 'System', label: 'View reports and analytics' },
  { key: 'export.limited', group: 'System', label: 'Export filtered lists', isDanger: true },
  { key: 'export.bulk', group: 'System', label: 'Export whole tables', isDanger: true },
];

export const ALL_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export const ROLE_KEYS = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES', 'STAFF', 'PARTNER'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

const MANAGER_SET = ALL_PERMISSION_KEYS.filter(
  (k) => !['role.manage', 'export.bulk', 'user.manage', 'audit.view', 'partner.portal', 'setting.manage'].includes(k),
);

const SALES_SET = [
  'property.view', 'property.create', 'property.edit', 'property.address.view', 'property.document.upload',
  'owner.view', 'owner.contact.view', 'owner.create', 'owner.edit',
  'client.view', 'client.create', 'client.edit',
  'requirement.view', 'requirement.create', 'requirement.edit',
  'lead.view', 'lead.create', 'lead.edit',
  'visit.view', 'visit.create', 'visit.edit',
  'deal.view', 'deal.create', 'deal.edit',
];

const STAFF_SET = [
  'property.view', 'property.create', 'property.edit', 'property.document.upload',
  'owner.create', 'client.view', 'lead.view', 'lead.create',
];

const PARTNER_SET = ['partner.portal'];

export const ROLE_DEFAULTS: Record<RoleKey, { name: string; rank: number; description: string; permissions: string[] }> = {
  SUPER_ADMIN: { name: 'Super Admin', rank: 0, description: 'Full access, including roles, settings and the audit log.', permissions: ALL_PERMISSION_KEYS },
  ADMIN: { name: 'Admin', rank: 10, description: 'Operational control and team management, without security settings.', permissions: ALL_PERMISSION_KEYS.filter((k) => !['role.manage', 'export.bulk', 'partner.portal'].includes(k)) },
  MANAGER: { name: 'Manager', rank: 20, description: 'Runs the desk: inventory, leads, visits and deals.', permissions: MANAGER_SET },
  SALES: { name: 'Sales Employee', rank: 30, description: 'Works their own leads, clients, visits and deals.', permissions: SALES_SET },
  STAFF: { name: 'Data Entry', rank: 40, description: 'Enters properties. No owner contact details, no commercials.', permissions: STAFF_SET },
  PARTNER: { name: 'Partner Consultant', rank: 50, description: 'External consultant with access to shared inventory only.', permissions: PARTNER_SET },
};

/** Resources whose list queries narrow to the user's own records without a *.view.all grant. */
export const SCOPED_RESOURCES = ['property', 'owner', 'client', 'requirement', 'lead', 'visit', 'deal'] as const;
