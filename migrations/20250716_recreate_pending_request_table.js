exports.up = async function(knex) {
  await knex.schema.dropTableIfExists('pending_request');
  await knex.schema.createTable('pending_request', function(table) {
    table.increments('id').primary();
    table.integer('sender_id').references('id').inTable('users').onDelete('SET NULL');
    table.integer('recipient_id').references('id').inTable('users').onDelete('CASCADE').notNullable();
    table.integer('gate_id').references('id').inTable('gates').onDelete('CASCADE').notNullable();
    table.enum('status', ['pending', 'accepted', 'declined']).defaultTo('pending');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.integer('establishment_id').references('id').inTable('establishments').onDelete('CASCADE').notNullable();
    
    // Add unique constraint to prevent duplicate invitations
    table.unique(['recipient_id', 'gate_id']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('pending_request');
};
