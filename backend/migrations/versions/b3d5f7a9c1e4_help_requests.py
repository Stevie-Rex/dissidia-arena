"""help requests

Revision ID: b3d5f7a9c1e4
Revises: a1c5e7b9d3f2
Create Date: 2026-11-24 15:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b3d5f7a9c1e4'
down_revision = 'a1c5e7b9d3f2'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('help_requests',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('match_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('message', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('claimed_by_id', sa.Integer(), nullable=True),
    sa.Column('claimed_at', sa.DateTime(), nullable=True),
    sa.Column('closed_by_id', sa.Integer(), nullable=True),
    sa.Column('closed_at', sa.DateTime(), nullable=True),
    sa.Column('close_reason', sa.Text(), nullable=True),
    sa.Column('notified', sa.Boolean(), nullable=False, server_default=sa.false()),
    sa.ForeignKeyConstraint(['claimed_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['closed_by_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['match_id'], ['matches.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('help_requests', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_help_requests_closed_at'), ['closed_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_help_requests_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_help_requests_match_id'), ['match_id'], unique=False)


def downgrade():
    with op.batch_alter_table('help_requests', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_help_requests_match_id'))
        batch_op.drop_index(batch_op.f('ix_help_requests_created_at'))
        batch_op.drop_index(batch_op.f('ix_help_requests_closed_at'))

    op.drop_table('help_requests')
