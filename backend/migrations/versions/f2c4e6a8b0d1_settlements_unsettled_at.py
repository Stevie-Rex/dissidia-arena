"""Rename settlements.undone_at to unsettled_at, the glossary's word (the Master reopening a match unsettles it)

Revision ID: f2c4e6a8b0d1
Revises: e8b1d3f5a7c9
Create Date: 2026-11-28 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2c4e6a8b0d1'
down_revision = 'e8b1d3f5a7c9'
branch_labels = None
depends_on = None

COPIED = ['id', 'match_id', 'outcome', 'winner_id', 'loser_id', 'ladder', 'settled_at']


def _rebuild(old: str, new: str) -> None:
    """Rebuild the table with the column renamed from old to new. The generated live_match_id is built
    from that column, and neither MariaDB nor SQLite will rename a column a generated column uses."""
    op.create_table(
        'settlements_rebuilt',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('match_id', sa.Integer(), nullable=False),
        sa.Column('outcome', sa.String(length=10), nullable=False),
        sa.Column('winner_id', sa.Integer(), nullable=True),
        sa.Column('loser_id', sa.Integer(), nullable=True),
        sa.Column('ladder', sa.String(length=16), nullable=False),
        sa.Column('settled_at', sa.DateTime(), nullable=False),
        sa.Column(new, sa.DateTime(), nullable=True),
        sa.Column('live_match_id', sa.Integer(),
                  sa.Computed(f'CASE WHEN {new} IS NULL THEN match_id END', persisted=True), nullable=True),
        sa.ForeignKeyConstraint(['match_id'], ['matches.id']),  # no CASCADE: see app.models.settlement
        sa.ForeignKeyConstraint(['winner_id'], ['users.id']),
        sa.ForeignKeyConstraint(['loser_id'], ['users.id']),
        sa.CheckConstraint("outcome IN ('completed', 'voided', 'forfeit')", name='ck_settlements_outcome'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('live_match_id'),
    )
    columns = ', '.join(COPIED)
    op.execute(f'INSERT INTO settlements_rebuilt ({columns}, {new}) SELECT {columns}, {old} FROM settlements')
    op.drop_table('settlements')  # takes its indexes with it (MariaDB won't drop one a foreign key needs)
    op.rename_table('settlements_rebuilt', 'settlements')
    for col in ('match_id', 'winner_id', 'loser_id'):
        op.create_index(f'ix_settlements_{col}', 'settlements', [col], unique=False)


def upgrade():
    _rebuild('undone_at', 'unsettled_at')


def downgrade():
    _rebuild('unsettled_at', 'undone_at')
