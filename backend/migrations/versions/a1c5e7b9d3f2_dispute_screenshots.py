"""dispute screenshots

Revision ID: a1c5e7b9d3f2
Revises: b8d2f4a6c1e3
Create Date: 2026-11-24 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1c5e7b9d3f2'
down_revision = 'b8d2f4a6c1e3'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('dispute_screenshots',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('match_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('round', sa.Integer(), nullable=False),
    sa.Column('filename', sa.String(length=64), nullable=True),
    sa.Column('content_type', sa.String(length=16), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.Column('removed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['match_id'], ['matches.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('dispute_screenshots', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_dispute_screenshots_match_id'), ['match_id'], unique=False)


def downgrade():
    with op.batch_alter_table('dispute_screenshots', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_dispute_screenshots_match_id'))

    op.drop_table('dispute_screenshots')
