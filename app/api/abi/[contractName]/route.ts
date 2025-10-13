import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contractName: string }> }
) {
  try {
    // Get folder from query param or fallback to env variable
    const { searchParams } = new URL(request.url);
    const folderFromQuery = searchParams.get('folder');
    const abisFolder = folderFromQuery || process.env.ABIS_FOLDER;

    if (!abisFolder) {
      return NextResponse.json(
        { error: 'ABIS_FOLDER not provided in query or environment variable' },
        { status: 500 }
      );
    }

    const { contractName } = await params;
    const abiPath = join(abisFolder, `${contractName}.sol`, `${contractName}.json`);

    const data = await readFile(abiPath, 'utf-8');
    const artifact = JSON.parse(data);

    // Return just the ABI array
    return NextResponse.json({ abi: artifact.abi });
  } catch (error) {
    console.error('Error loading ABI:', error);
    return NextResponse.json(
      { error: 'Failed to load ABI file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 404 }
    );
  }
}
