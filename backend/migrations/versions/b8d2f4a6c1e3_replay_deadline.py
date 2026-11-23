"""The Replay Ruling's deadline, the "Replay not finished" marker, and disputes from before a Replay

Revision ID: b8d2f4a6c1e3
Revises: a6c8e0b2d4f7
Create Date: 2026-11-23 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b8d2f4a6c1e3'
down_revision = 'a6c8e0b2d4f7'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('matches', schema=None) as batch_op:
        batch_op.add_column(sa.Column('replay_deadline', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('replay_unfinished', sa.Boolean(), server_default=sa.false(), nullable=False))
        batch_op.add_column(sa.Column('earlier_disputes', sa.JSON(), nullable=True))
        batch_op.create_index(batch_op.f('ix_matches_replay_deadline'), ['replay_deadline'], unique=False)


def downgrade():
    with op.batch_alter_table('matches', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_matches_replay_deadline'))
        batch_op.drop_column('earlier_disputes')
        batch_op.drop_column('replay_unfinished')
        batch_op.drop_column('replay_deadline')
