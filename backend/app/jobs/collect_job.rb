class CollectJob < ApplicationJob
  queue_as :default

  def perform(user_id, start_date, end_date)
    user = User.find(user_id)
    token = user.access_token
    raise "No access token for user #{user_id}" unless token

    raw = GithubCollector.new(token:, start_date:, end_date:).collect_raw
    evidence = EvidenceNormalizer.normalize(raw, start_date, end_date)

    year = Date.parse(start_date).year
    review_year = user.review_years.find_or_initialize_by(year: year)
    review_year.start_date = start_date
    review_year.end_date = end_date
    review_year.evidence = evidence
    review_year.evidence_updated_at = Time.current
    review_year.save!
    Rails.cache.write("job:#{job_id}", { status: "done", result: evidence }, expires_in: 1.hour)
  end
end
