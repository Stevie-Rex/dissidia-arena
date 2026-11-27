"""The settlements table: one row for each settle of a match

Revision ID: e8b1d3f5a7c9
Revises: d4f6a8c0e2b1
Create Date: 2026-11-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e8b1d3f5a7c9'
down_revision = 'd4f6a8c0e2b1'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'settlements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('match_id', sa.Integer(), nullable=False),
        sa.Column('outcome', sa.String(length=10), nullable=False),
        sa.Column('winner_id', sa.Integer(), nullable=True),
        sa.Column('loser_id', sa.Integer(), nullable=True),
        sa.Column('ladder', sa.String(length=16), nullable=False),
        sa.Column('settled_at', sa.DateTime(), nullable=False),
        sa.Column('undone_at', sa.DateTime(), nullable=True),
        # The match id while the row counts, NULL once undone; unique, so a match has at most one
        # live row. MariaDB has no partial unique indexes.
        sa.Column('live_match_id', sa.Integer(),
                  sa.Computed('CASE WHEN undone_at IS NULL THEN match_id END', persisted=True), nullable=True),
        sa.ForeignKeyConstraint(['match_id'], ['matches.id']),  # no CASCADE: see app.models.settlement
        sa.ForeignKeyConstraint(['winner_id'], ['users.id']),
        sa.ForeignKeyConstraint(['loser_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('live_match_id'),
    )
    op.create_index(op.f('ix_settlements_match_id'), 'settlements', ['match_id'], unique=False)
    op.create_index(op.f('ix_settlements_winner_id'), 'settlements', ['winner_id'], unique=False)
    op.create_index(op.f('ix_settlements_loser_id'), 'settlements', ['loser_id'], unique=False)

    # Every match already Settled gets its row, settled when it finished.
    matches = sa.table(
        'matches', sa.column('id', sa.Integer), sa.column('status', sa.String), sa.column('game', sa.String),
        sa.column('platform', sa.String), sa.column('player_a_id', sa.Integer), sa.column('player_b_id', sa.Integer),
        sa.column('winner_id', sa.Integer), sa.column('finished_at', sa.DateTime), sa.column('created_at', sa.DateTime),
    )
    settlements = sa.table(
        'settlements', sa.column('match_id'), sa.column('outcome'), sa.column('winner_id'), sa.column('loser_id'),
        sa.column('ladder'), sa.column('settled_at'),
    )
    won = sa.and_(matches.c.status == 'completed', matches.c.winner_id.is_not(None))
    loser = sa.case((matches.c.winner_id == matches.c.player_a_id, matches.c.player_b_id), else_=matches.c.player_a_id)
    op.execute(settlements.insert().from_select(
        ['match_id', 'outcome', 'winner_id', 'loser_id', 'ladder', 'settled_at'],
        sa.select(
            matches.c.id,
            matches.c.status,
            sa.case((won, matches.c.winner_id)),
            sa.case((won, loser)),
            matches.c.game + '/' + matches.c.platform,  # || on SQLite, concat() on MariaDB
            sa.func.coalesce(matches.c.finished_at, matches.c.created_at),
        ).where(matches.c.status.in_(['completed', 'voided'])),
    ))


def downgrade():
    op.drop_index(op.f('ix_settlements_loser_id'), table_name='settlements')
    op.drop_index(op.f('ix_settlements_winner_id'), table_name='settlements')
    op.drop_index(op.f('ix_settlements_match_id'), table_name='settlements')
    op.drop_table('settlements')
