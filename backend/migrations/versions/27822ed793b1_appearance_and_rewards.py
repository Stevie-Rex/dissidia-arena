"""appearance and rewards

Revision ID: 27822ed793b1
Revises: b7d41c2e9f10
Create Date: 2026-11-21 14:15:29.338193

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '27822ed793b1'
down_revision = 'b7d41c2e9f10'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('user_preferences',
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('interface', sa.String(length=10), nullable=False),
    sa.Column('world', sa.String(length=20), nullable=False),
    sa.Column('window_theme', sa.String(length=20), nullable=False),
    sa.Column('menu_font', sa.String(length=10), nullable=False),
    sa.Column('cursor_style', sa.String(length=10), nullable=False),
    sa.Column('window_r', sa.SmallInteger(), nullable=False),
    sa.Column('window_g', sa.SmallInteger(), nullable=False),
    sa.Column('window_b', sa.SmallInteger(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id')
    )
    op.create_table('user_unlocks',
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('reward_key', sa.String(length=40), nullable=False),
    sa.Column('unlocked_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('match_id', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['match_id'], ['matches.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('user_id', 'reward_key')
    )
    with op.batch_alter_table('user_unlocks', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_user_unlocks_match_id'), ['match_id'], unique=False)

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('ranked_wins', sa.Integer(), server_default='0', nullable=False))



def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('ranked_wins')

    with op.batch_alter_table('user_unlocks', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_user_unlocks_match_id'))

    op.drop_table('user_unlocks')
    op.drop_table('user_preferences')
