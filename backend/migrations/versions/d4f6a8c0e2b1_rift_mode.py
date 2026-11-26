"""Add the Rift mode preference (Chaos mode or Cosmos mode)

Revision ID: d4f6a8c0e2b1
Revises: c7e9a1b3d5f8
Create Date: 2026-11-26 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4f6a8c0e2b1'
down_revision = 'c7e9a1b3d5f8'
branch_labels = None
depends_on = None


def upgrade():
    # Everyone starts in Chaos mode, the default.
    with op.batch_alter_table('user_preferences') as batch_op:
        batch_op.add_column(sa.Column('rift_mode', sa.String(length=10), nullable=False, server_default='chaos'))


def downgrade():
    with op.batch_alter_table('user_preferences') as batch_op:
        batch_op.drop_column('rift_mode')
