import React, { useEffect, useState } from 'react'
import useHomeViewModel from './useHomeViewModel'
import JobCard from '../../components/JobCard'
import type { Job } from '../../types/job'

export interface HomeViewProps {
  onBookmark?: (job: Job) => void
}

export const HomeView: React.FC<HomeViewProps> = ({
  onBookmark,
}) => {
  const {
    jobs,
    loading,
    error,
    filter,
    setFilter,
    loadJobs,
    handleSearch,
    setCategoryFilter,
    setJobTypeFilter,
    resetFilters,
    activeSource,
    totalJobs,
  } = useHomeViewModel()

  /*
   * Local search input.
   *
   * IMPORTANT:
   * Typing here does NOT immediately call the API.
   * The request happens when the user presses Search.
   */
  const [searchInput, setSearchInput] =
    useState(filter.searchQuery)

  /*
   * Keep local input synchronized if the ViewModel
   * changes the search query externally.
   */
  useEffect(() => {
    setSearchInput(filter.searchQuery)
  }, [filter.searchQuery])

  /* ------------------------------------------------------------------------ */
  /* STYLES                                                                   */
  /* ------------------------------------------------------------------------ */

  const styles: {
    [key: string]: React.CSSProperties
  } = {
    page: {
      padding: 24,
    },

    hero: {
      marginBottom: 20,
    },

    title: {
      margin: 0,
      fontSize: 28,
      color: '#0f172a',
    },

    subtitle: {
      marginTop: 8,
      color: '#475569',
    },

    stats: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
      flexWrap: 'wrap',
    },

    count: {
      color: '#0f172a',
    },

    source: {
      padding: '4px 10px',
      background: '#e0f2fe',
      borderRadius: 999,
      color: '#0369a1',
      fontSize: 12,
    },

    form: {
      display: 'flex',
      gap: 8,
      marginTop: 16,
      flexWrap: 'wrap',
    },

    input: {
      padding: '10px 12px',
      borderRadius: 8,
      border: '1px solid #e6e9ef',
      minWidth: 280,
      flex: '1 1 280px',
      outline: 'none',
    },

    select: {
      padding: '10px 12px',
      borderRadius: 8,
      border: '1px solid rgba(148, 163, 184, 0.16)',
      background: 'rgba(15, 23, 42, 0.9)',
      color: '#e2e8f0',
      colorScheme: 'dark' as const,
      cursor: 'pointer',
    },

    button: {
      padding: '10px 14px',
      borderRadius: 8,
      border: 'none',
      background: '#0369a1',
      color: '#fff',
      cursor: 'pointer',
      fontWeight: 600,
    },

    disabledButton: {
      opacity: 0.6,
      cursor: 'not-allowed',
    },

    grid: {
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fill, minmax(320px, 1fr))',
      gap: 16,
      marginTop: 20,
    },

    loading: {
      padding: 20,
      textAlign: 'center',
      color: '#64748b',
    },

    error: {
      padding: 16,
      background: '#fff1f2',
      color: '#991b1b',
      borderRadius: 8,
    },

    empty: {
      padding: 20,
      textAlign: 'center',
      color: '#64748b',
    },
  }

  /* ------------------------------------------------------------------------ */
  /* SEARCH                                                                   */
  /* ------------------------------------------------------------------------ */

  const onSubmit = async (
    event: React.FormEvent
  ) => {
    event.preventDefault()

    /*
     * Prevent unnecessary request while another
     * request is already running.
     *
     * The user can still change filters afterwards.
     */
    if (loading) {
      return
    }

    await handleSearch(searchInput.trim())
  }

  /* ------------------------------------------------------------------------ */
  /* CATEGORY                                                                 */
  /* ------------------------------------------------------------------------ */

  const onCategoryChange = async (
    value: string
  ) => {
    const updatedFilter = {
      ...filter,
      category: value,
    }

    setFilter(updatedFilter)

    await setCategoryFilter(value)
  }

  /* ------------------------------------------------------------------------ */
  /* JOB TYPE                                                                  */
  /* ------------------------------------------------------------------------ */

  const onJobTypeChange = async (
    value: string
  ) => {
    const updatedFilter = {
      ...filter,
      jobType: value,
    }

    setFilter(updatedFilter)

    await setJobTypeFilter(value)
  }

  /* ------------------------------------------------------------------------ */
  /* RESET                                                                    */
  /* ------------------------------------------------------------------------ */

  const onResetFilters = async () => {
    setSearchInput('')

    await resetFilters()
  }

  /* ------------------------------------------------------------------------ */
  /* RETRY                                                                    */
  /* ------------------------------------------------------------------------ */

  const onRetry = async () => {
    await loadJobs(filter)
  }

  /* ------------------------------------------------------------------------ */
  /* RENDER                                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <section style={styles.page}>
      <header style={styles.hero}>
        <h1 style={styles.title}>
          Find Your Next Tech Job & Internship
        </h1>

        <p style={styles.subtitle}>
          Search remote-friendly roles across engineering,
          design, marketing and more.
        </p>

        {/* ---------------------------------------------------------------- */}
        {/* JOB STATS                                                         */}
        {/* ---------------------------------------------------------------- */}

        <div style={styles.stats}>
          <strong style={styles.count}>
            {totalJobs} jobs available
          </strong>

          <span style={styles.source}>
            Source: {activeSource}
          </span>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* SEARCH / FILTER FORM                                             */}
        {/* ---------------------------------------------------------------- */}

        <form
          onSubmit={onSubmit}
          style={styles.form}
          aria-label="job-search-form"
        >
          <input
            aria-label="Search jobs"
            placeholder="Search by title, company or keyword"
            style={styles.input}
            value={searchInput}
            disabled={loading}
            onChange={(event) => {
              /*
               * ONLY update local state.
               *
               * NO API request here.
               */
              setSearchInput(event.target.value)
            }}
          />

          {/* -------------------------------------------------------------- */}
          {/* CATEGORY                                                        */}
          {/* -------------------------------------------------------------- */}

          <select
            aria-label="Filter by category"
            style={styles.select}
            value={filter.category}
            disabled={loading}
            onChange={(event) => {
              void onCategoryChange(
                event.target.value
              )
            }}
          >
            <option value="">
              All categories
            </option>

            <option value="Frontend">
              Frontend
            </option>

            <option value="Backend">
              Backend
            </option>

            <option value="Full Stack">
              Full Stack
            </option>

            <option value="Mobile">
              Mobile
            </option>

            <option value="UI/UX Design">
              UI/UX Design
            </option>

            <option value="DevOps">
              DevOps
            </option>

            <option value="Data Science">
              Data Science
            </option>

            <option value="Cyber Security">
              Cyber Security
            </option>

            <option value="Quality Assurance (QA)">
              Quality Assurance (QA)
            </option>

            <option value="Product Management">
              Product Management
            </option>

            <option value="AI/ML">
              AI/ML
            </option>

            <option value="Marketing">
              Marketing
            </option>
          </select>

          {/* -------------------------------------------------------------- */}
          {/* JOB TYPE                                                        */}
          {/* -------------------------------------------------------------- */}

          <select
            aria-label="Filter by job type"
            style={styles.select}
            value={filter.jobType}
            disabled={loading}
            onChange={(event) => {
              void onJobTypeChange(
                event.target.value
              )
            }}
          >
            <option value="all">
              All types
            </option>

            <option value="Full-time">
              Full-time
            </option>

            <option value="Part-time">
              Part-time
            </option>

            <option value="Remote">
              Remote
            </option>

            <option value="Contract">
              Contract
            </option>

            <option value="Internship">
              Internship
            </option>
          </select>

          {/* -------------------------------------------------------------- */}
          {/* RESET                                                           */}
          {/* -------------------------------------------------------------- */}

          {(
            searchInput.trim() ||
            filter.category ||
            (
              filter.jobType &&
              filter.jobType !== 'all'
            ) ||
            filter.location
          ) && (
            <button
              type="button"
              onClick={() => {
                void onResetFilters()
              }}
              disabled={loading}
              style={{
                ...styles.button,
                background: '#6b7280',
                ...(loading
                  ? styles.disabledButton
                  : {}),
              }}
            >
              Reset Filters
            </button>
          )}

          {/* -------------------------------------------------------------- */}
          {/* SEARCH                                                          */}
          {/* -------------------------------------------------------------- */}

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading
                ? styles.disabledButton
                : {}),
            }}
          >
            {loading
              ? 'Loading...'
              : 'Search'}
          </button>
        </form>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* ERROR                                                              */}
      {/* ------------------------------------------------------------------ */}

      {error ? (
        <div
          style={styles.error}
          role="alert"
        >
          <div>{error}</div>

          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => {
                void onRetry()
              }}
              disabled={loading}
              style={{
                ...styles.button,
                background: '#ef4444',
                ...(loading
                  ? styles.disabledButton
                  : {}),
              }}
            >
              {loading
                ? 'Retrying...'
                : 'Retry'}
            </button>
          </div>
        </div>
      ) : jobs.length > 0 ? (
        <>
          {/* -------------------------------------------------------------- */}
          {/* JOB GRID                                                        */}
          {/* -------------------------------------------------------------- */}

          <div style={styles.grid}>
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onBookmark={onBookmark}
              />
            ))}
          </div>

          {/* -------------------------------------------------------------- */}
          {/* LOADING INDICATOR                                               */}
          {/* -------------------------------------------------------------- */}

          {loading && (
            <div
              style={{
                ...styles.loading,
                marginTop: 16,
              }}
            >
              Loading jobs...
            </div>
          )}
        </>
      ) : loading ? (
        <div style={styles.loading}>
          Loading jobs...
        </div>
      ) : (
        <div style={styles.empty}>
          No jobs found. Try adjusting your
          search or filters.
        </div>
      )}
    </section>
  )
}

export default HomeView