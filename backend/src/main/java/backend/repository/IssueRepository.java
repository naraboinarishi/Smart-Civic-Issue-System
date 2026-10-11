package backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import backend.model.Issue;

public interface IssueRepository extends JpaRepository<Issue, Integer> {
}