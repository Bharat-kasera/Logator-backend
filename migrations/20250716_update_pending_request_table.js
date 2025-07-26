// Migration script to update pending_request table structure
// Requires: knex

exports.up = async function(knex) {
  // Drop unwanted columns if they exist
  const hasId = await knex.schema.hasColumn('pending_request', 'id');
  const hasTargetId = await knex.schema.hasColumn('pending_request', 'target_id');
  const hasRequestedBy = await knex.schema.hasColumn('pending_request', 'requested_by');

  await knex.schema.alterTable('pending_request', function(table) {
    if (hasId) table.dropColumn('id');
    if (hasTargetId) table.dropColumn('target_id');
    if (hasRequestedBy) table.dropColumn('requested_by');
  });

  // Add required columns if they do not exist
  const hasGateDeptId = await knex.schema.hasColumn('pending_request', 'gate_dept_id');
  const hasUserId = await knex.schema.hasColumn('pending_request', 'user_id');
  const hasType = await knex.schema.hasColumn('pending_request', 'type');
  const hasCreatedAt = await knex.schema.hasColumn('pending_request', 'created_at');
  const hasEstablishmentId = await knex.schema.hasColumn('pending_request', 'establishment_id');

  await knex.schema.alterTable('pending_request', function(table) {
    if (!hasGateDeptId) table.integer('gate_dept_id');
    if (!hasUserId) table.integer('user_id');
    if (!hasType) table.string('type');
    if (!hasCreatedAt) table.timestamp('created_at').defaultTo(knex.fn.now());
    if (!hasEstablishmentId) table.integer('establishment_id');
  });
};

exports.down = async function(knex) {
  // Optional: revert changes if needed
  await knex.schema.alterTable('pending_request', function(table) {
    table.dropColumn('gate_dept_id');
    table.dropColumn('user_id');
    table.dropColumn('type');
    table.dropColumn('created_at');
    table.dropColumn('establishment_id');
    // You may want to re-add dropped columns here if needed
  });
};
