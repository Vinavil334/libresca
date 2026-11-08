'use server';

import { type CreateEditionResult, createEdition, findAuthorsByOpenLibraryIds } from '@libresca/data';
import { type EditionProposal, type ProposalEdits, editedCatalogEntry, openLibraryAuthorIds } from '@libresca/metadata';

import { createSupabaseServerClient } from '@/lib/supabase/server';

export interface AddEditionInput {
  proposal: EditionProposal;
  edits: ProposalEdits;
  /** Add the edition to this catalog work instead of creating a new one. */
  workId?: string;
}

/**
 * Saves a confirmed proposal to the catalog with the user's session. The proposal comes
 * back from the client, so it is treated as user input: `createEdition` validates it and
 * the database checks the account and repeats the essential rules (no Google Books
 * description, no Google Books payload).
 */
export async function addEdition({ proposal, edits, workId }: AddEditionInput): Promise<CreateEditionResult> {
  const client = await createSupabaseServerClient();
  const knownAuthors = workId ? {} : await findAuthorsByOpenLibraryIds(client, openLibraryAuthorIds(proposal));
  return createEdition(client, editedCatalogEntry(proposal, edits, { workId, knownAuthors }));
}
