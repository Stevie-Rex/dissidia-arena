"""Drop Rift worlds (ADR 0001)

Revision ID: c7e9a1b3d5f8
Revises: b3d5f7a9c1e4
Create Date: 2026-11-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c7e9a1b3d5f8'
down_revision = 'b3d5f7a9c1e4'
branch_labels = None
depends_on = None


def upgrade():
    # A saved world is dropped without a replacement: worlds were free, so nothing is lost.
    with op.batch_alter_table('user_preferences') as batch_op:
        batch_op.drop_column('world')


def downgrade():
    # Everyone comes back on the old default world.
    with op.batch_alter_table('user_preferences') as batch_op:
        batch_op.add_column(sa.Column('world', sa.String(length=20), nullable=False, server_default='dissidia'))
