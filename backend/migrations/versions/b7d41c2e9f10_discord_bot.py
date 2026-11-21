"""discord bot: guild configs and match notification tracking

Revision ID: b7d41c2e9f10
Revises: 0315ee565a31
Create Date: 2026-11-17 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b7d41c2e9f10'
down_revision = '0315ee565a31'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('guild_configs',
    sa.Column('guild_id', sa.BigInteger(), autoincrement=False, nullable=False),
    sa.Column('game', sa.String(length=8), nullable=False),
    sa.Column('queue_channel_id', sa.BigInteger(), nullable=False),
    sa.Column('ping_role_id', sa.BigInteger(), nullable=True),
    sa.Column('mod_role_id', sa.BigInteger(), nullable=True),
    sa.Column('last_ping_at', sa.DateTime(), nullable=True),
    sa.PrimaryKeyConstraint('guild_id')
    )
    with op.batch_alter_table('guild_configs', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_guild_configs_game'), ['game'], unique=False)

    with op.batch_alter_table('matches', schema=None) as batch_op:
        batch_op.add_column(sa.Column('notified_status', sa.String(length=12), nullable=True))


def downgrade():
    with op.batch_alter_table('matches', schema=None) as batch_op:
        batch_op.drop_column('notified_status')

    with op.batch_alter_table('guild_configs', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_guild_configs_game'))

    op.drop_table('guild_configs')
