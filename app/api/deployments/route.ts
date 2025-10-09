import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';

export async function GET() {
  try {
    const deploymentsPath = process.env.DEPLOYMENTS_FILE;

    if (!deploymentsPath) {
      return NextResponse.json(
        { error: 'DEPLOYMENTS_FILE environment variable not set' },
        { status: 500 }
      );
    }

    const data = await readFile(deploymentsPath, 'utf-8');
    const deployments = JSON.parse(data);

    return NextResponse.json(deployments);
  } catch (error) {
    console.error('Error loading deployments:', error);
    return NextResponse.json(
      { error: 'Failed to load deployments file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
