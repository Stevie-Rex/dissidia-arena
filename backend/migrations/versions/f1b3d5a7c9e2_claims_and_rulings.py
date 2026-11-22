"""Claims and Rulings on Disputed matches

Revision ID: f1b3d5a7c9e2
Revises: e4a7c9b1d3f6
Create Date: 2026-11-22 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1b3d5a7c9e2'
down_revision = 'e4a7c9b1d3f6'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('matches', schema=None) as batch_op:
        batch_op.add_column(sa.Column('claimed_by_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('claimed_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('ruling', sa.String(length=12), nullable=True))
        batch_op.add_column(sa.Column('ruling_reason', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('ruled_by_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('ruled_at', sa.DateTime(), nullable=True))
        batch_op.create_foreign_key('fk_matches_claimed_by_id_users', 'users', ['claimed_by_id'], ['id'])
        batch_op.create_foreign_key('fk_matches_ruled_by_id_users', 'users', ['ruled_by_id'], ['id'])


def downgrade():
    with op.batch_alter_table('matches', schema=None) as batch_op:
        batch_op.drop_constraint('fk_matches_ruled_by_id_users', type_='foreignkey')
        batch_op.drop_constraint('fk_matches_claimed_by_id_users', type_='foreignkey')
        batch_op.drop_column('ruled_at')
        batch_op.drop_column('ruled_by_id')
        batch_op.drop_column('ruling_reason')
        batch_op.drop_column('ruling')
        batch_op.drop_column('claimed_at')
        batch_op.drop_column('claimed_by_id')
