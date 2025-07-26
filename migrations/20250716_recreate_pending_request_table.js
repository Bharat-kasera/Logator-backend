exports.up = async function(knex) {
  await knex.schema.dropTableIfExists('pending_request');
  await knex.schema.createTable('pending_request', function(table) {
    table.integer('gate_dept_id').notNullable();
    table.integer('user_id').notNullable();
    table.string('type').notNullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.integer('establishment_id').notNullable();
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('pending_request');
};
