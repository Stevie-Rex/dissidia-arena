"""When each match was disputed

Revision ID: a6c8e0b2d4f7
Revises: f1b3d5a7c9e2
Create Date: 2026-11-22 12:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a6c8e0b2d4f7'
down_revision = 'f1b3d5a7c9e2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('matches', schema=None) as batch_op:
        batch_op.add_column(sa.Column('disputed_at', sa.DateTime(), nullable=True))
    # Until now finished_at was set when a match was disputed; Rulings that moved it came with the
    # previous migration, so for open disputes it is still the dispute time.
    op.execute(
        "UPDATE matches SET disputed_at = finished_at "
        "WHERE status = 'disputed' OR dispute_reason IS NOT NULL OR ruling IS NOT NULL"
    )


def downgrade():
    with op.batch_alter_table('matches', schema=None) as batch_op:
        batch_op.drop_column('disputed_at')
