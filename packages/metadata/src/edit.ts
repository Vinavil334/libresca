import { type CatalogEntryInput, type EditionFormat, cleanText, editionFormats } from '@libresca/domain';

import { proposalToCatalogEntry } from './merge';
import type { CandidateEdition, WorkCandidate } from './search';
import { matchKey } from './text';
import type { EditionProposal, ProposalAuthor, Sourced } from './types';

/**
 * The fields the user can correct before saving, as typed in the form: numbers stay
 * strings so a wrong value reaches the validator instead of silently disappearing.
 */
export interface ProposalEdits {
  title: string;
  authors: string[];
  publisher: string;
  publishedYear: string;
  pageCount: string;
  format: EditionFormat | '';
}

/** The form's starting values for a proposal. */
export function editsFromProposal(proposal: EditionProposal): ProposalEdits {
  return {
    title: proposal.title?.value ?? '',
    authors: proposal.authors.map((author) => author.name),
    publisher: proposal.publisher?.value ?? '',
    publishedYear: proposal.publishedYear ? String(proposal.publishedYear.value) : '',
    pageCount: proposal.pageCount ? String(proposal.pageCount.value) : '',
    format: proposal.format?.value ?? '',
  };
}

/** Empty: undefined. Otherwise a number, possibly NaN or fractional, for the validator to reject. */
function typedNumber(value: string): number | undefined {
  const clean = value.trim();
  return clean ? Number(clean) : undefined;
}

/** The proposed value when the user left it alone, the typed one marked `user` when changed. */
function edited<T>(original: Sourced<T> | undefined, value: T | undefined): Sourced<T> | undefined {
  if (value === undefined) return undefined;
  if (original && original.value === value) return original;
  return { value, source: 'user' };
}

function editedAuthors(proposal: EditionProposal, names: string[]): Pick<EditionProposal, 'authors' | 'authorsSource'> {
  const clean = names.map(cleanText).filter(Boolean);
  const unchanged =
    clean.length === proposal.authors.length && clean.every((name, i) => name === proposal.authors[i]?.name);
  if (unchanged) return { authors: proposal.authors, authorsSource: proposal.authorsSource };

  // A name the sources also gave keeps its ids and alternate names, even if moved.
  const authors = clean.map(
    (name): ProposalAuthor =>
      proposal.authors.find((author) => matchKey(author.name) === matchKey(name)) ?? {
        name,
        alternateNames: [],
        externalIds: [],
      },
  );
  return { authors, authorsSource: clean.length > 0 ? 'user' : undefined };
}

export interface EditOptions {
  /** Add the edition to this catalog work instead of creating one: its title and authors stay. */
  workId?: string;
  /** Catalog authors by Open Library author id: the same person is reused, never duplicated. */
  knownAuthors?: Record<string, string>;
}

/** The proposal with the user's corrections, provenance included. */
export function applyEdits(proposal: EditionProposal, edits: ProposalEdits): EditionProposal {
  const title = cleanText(edits.title);
  const publisher = cleanText(edits.publisher);
  const format = editionFormats.find((option) => option === edits.format);
  return {
    ...proposal,
    title: edited(proposal.title, title || undefined),
    ...editedAuthors(proposal, edits.authors),
    publisher: edited(proposal.publisher, publisher || undefined),
    publishedYear: edited(proposal.publishedYear, typedNumber(edits.publishedYear)),
    pageCount: (() => {
      const value = edited(proposal.pageCount, typedNumber(edits.pageCount));
      return value && { ...value, reliable: value.source !== 'googlebooks' };
    })(),
    format: edited(proposal.format, format),
  };
}

/**
 * The catalog entry for a proposal the user confirmed, with their corrections. Validation
 * happens later, in `createEdition`, so a wrong year or page count comes back as an issue.
 */
export function editedCatalogEntry(
  proposal: EditionProposal,
  edits: ProposalEdits,
  options: EditOptions = {},
): CatalogEntryInput {
  const entry = proposalToCatalogEntry(applyEdits(proposal, edits));
  if (options.workId) {
    return { work: { id: options.workId }, edition: { ...entry.edition, title: cleanText(edits.title) || undefined } };
  }
  if ('id' in entry.work) return entry;

  const known = options.knownAuthors ?? {};
  const authors = entry.work.authors.map((author) => {
    if ('id' in author) return author;
    const openLibraryId = author.externalIds?.find((id) => id.source === 'openlibrary')?.value;
    const id = openLibraryId ? known[openLibraryId] : undefined;
    return id ? { id } : author;
  });
  return { ...entry, work: { ...entry.work, authors } };
}

/** The Open Library author ids of a proposal, to look up in the catalog before saving. */
export function openLibraryAuthorIds(proposal: EditionProposal): string[] {
  return proposal.authors.flatMap((author) =>
    author.externalIds.flatMap((id) => (id.source === 'openlibrary' ? [id.value] : [])),
  );
}

/** A blank proposal for typing a book by hand, with the ISBN when there is one. */
export function emptyProposal(isbn13?: string): EditionProposal {
  return { isbn13, authors: [], contributors: [], editionExternalIds: [], workExternalIds: [] };
}

/**
 * A proposal from a search result, for an edition without ISBN: what the search knows, with
 * its source. The work id from Open Library comes along; Google Books keeps only the volume id.
 */
export function candidateProposal(candidate: WorkCandidate, edition: CandidateEdition): EditionProposal {
  const source = edition.source;
  const sourced = <T>(value: T | undefined): Sourced<T> | undefined =>
    value === undefined ? undefined : { value, source };
  const title = edition.title ?? candidate.title;
  return {
    isbn13: edition.isbn13,
    title: { value: title, source },
    authors: candidate.authors.map((name) => ({ name, alternateNames: [], externalIds: [] })),
    authorsSource: candidate.authors.length > 0 ? source : undefined,
    publisher: sourced(edition.publisher),
    publishedYear: sourced(edition.publishedYear),
    firstPublishedYear:
      candidate.firstPublishedYear === undefined || !candidate.openLibraryWorkId
        ? undefined
        : { value: candidate.firstPublishedYear, source: 'openlibrary' },
    language: sourced(edition.language),
    cover: edition.cover ?? undefined,
    contributors: [],
    editionExternalIds: [{ source, value: edition.editionId }],
    workExternalIds: candidate.openLibraryWorkId ? [{ source: 'openlibrary', value: candidate.openLibraryWorkId }] : [],
  };
}
