import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import { join } from 'path';

export async function GET(request: Request) {
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

    // Read all directories in the ABIs folder
    const entries = await readdir(abisFolder, { withFileTypes: true });

    // Filter for directories ending with .sol
    const solDirs = entries.filter(
      (entry) => entry.isDirectory() && entry.name.endsWith('.sol')
    );

    // Extract contract names (remove .sol extension)
    const availableContracts: string[] = [];

    for (const dir of solDirs) {
      const contractName = dir.name.replace('.sol', '');
      const jsonPath = join(abisFolder, dir.name, `${contractName}.json`);

      // Check if the corresponding .json file exists
      try {
        await readdir(join(abisFolder, dir.name));
        const files = await readdir(join(abisFolder, dir.name));
        if (files.includes(`${contractName}.json`)) {
          availableContracts.push(contractName);
        }
      } catch (err) {
        // Skip if directory can't be read or file doesn't exist
        continue;
      }
    }

    return NextResponse.json({ contracts: availableContracts });
  } catch (error) {
    console.error('Error listing ABIs:', error);
    return NextResponse.json(
      { error: 'Failed to list ABI files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
