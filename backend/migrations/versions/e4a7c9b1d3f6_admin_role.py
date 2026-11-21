"""Admins: when each was appointed

Revision ID: e4a7c9b1d3f6
Revises: d9e2b6c4a7f1
Create Date: 2026-11-21 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e4a7c9b1d3f6'
down_revision = 'd9e2b6c4a7f1'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('admin_since', sa.DateTime(), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('admin_since')
