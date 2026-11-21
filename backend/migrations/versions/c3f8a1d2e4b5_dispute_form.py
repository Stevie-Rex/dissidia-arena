"""dispute form: disputed games, reason and players' statements

Revision ID: c3f8a1d2e4b5
Revises: 27822ed793b1
Create Date: 2026-11-21 18:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c3f8a1d2e4b5'
down_revision = '27822ed793b1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('dispute_statements',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('match_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['match_id'], ['matches.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('match_id', 'user_id')
    )
    with op.batch_alter_table('matches', schema=None) as batch_op:
        batch_op.add_column(sa.Column('dispute_games', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('dispute_reason', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('matches', schema=None) as batch_op:
        batch_op.drop_column('dispute_reason')
        batch_op.drop_column('dispute_games')

    op.drop_table('dispute_statements')
