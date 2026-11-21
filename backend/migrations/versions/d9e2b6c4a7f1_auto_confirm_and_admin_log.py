"""auto-confirm deadline and the Admin log

Revision ID: d9e2b6c4a7f1
Revises: c3f8a1d2e4b5
Create Date: 2026-11-21 19:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd9e2b6c4a7f1'
down_revision = 'c3f8a1d2e4b5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('admin_log',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('actor_id', sa.Integer(), nullable=True),
    sa.Column('action', sa.String(length=32), nullable=False),
    sa.Column('match_id', sa.Integer(), nullable=True),
    sa.Column('target_id', sa.Integer(), nullable=True),
    sa.Column('reason', sa.Text(), nullable=False),
    sa.Column('details', sa.JSON(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['match_id'], ['matches.id'], ),
    sa.ForeignKeyConstraint(['target_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('admin_log', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_admin_log_action'), ['action'], unique=False)
        batch_op.create_index(batch_op.f('ix_admin_log_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_admin_log_match_id'), ['match_id'], unique=False)

    with op.batch_alter_table('matches', schema=None) as batch_op:
        batch_op.add_column(sa.Column('confirm_deadline', sa.DateTime(), nullable=True))
        batch_op.create_index(batch_op.f('ix_matches_confirm_deadline'), ['confirm_deadline'], unique=False)

    # Results already waiting for confirmation get the full 2 hours from now, not from when
    # they were reported (which isn't recorded).
    if op.get_bind().dialect.name in ('mysql', 'mariadb'):
        two_hours = "DATE_ADD(UTC_TIMESTAMP(), INTERVAL 2 HOUR)"
    else:
        two_hours = "datetime('now', '+2 hours')"
    op.execute(f"UPDATE matches SET confirm_deadline = {two_hours} WHERE status = 'reported'")


def downgrade():
    with op.batch_alter_table('matches', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_matches_confirm_deadline'))
        batch_op.drop_column('confirm_deadline')

    with op.batch_alter_table('admin_log', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_admin_log_match_id'))
        batch_op.drop_index(batch_op.f('ix_admin_log_created_at'))
        batch_op.drop_index(batch_op.f('ix_admin_log_action'))

    op.drop_table('admin_log')
