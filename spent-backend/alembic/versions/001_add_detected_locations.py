"""add detected_locations table

Revision ID: 001
Revises:
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa

revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'detected_locations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('google_place_id', sa.String(), nullable=False),
        sa.Column('place_name', sa.String(), nullable=False),
        sa.Column('address', sa.String(), nullable=False),
        sa.Column('category', sa.String(), nullable=False),
        sa.Column('latitude', sa.Float(), nullable=False),
        sa.Column('longitude', sa.Float(), nullable=False),
        sa.Column('arrived_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('flashcard_shown', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('detected_locations')
