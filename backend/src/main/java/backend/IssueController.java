
package backend;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import backend.model.Issue;
import backend.repository.IssueRepository;

@RestController
@RequestMapping("/api/issues")
@CrossOrigin(origins = "http://localhost:5173")
public class IssueController {

    private final IssueRepository issueRepository;

    public IssueController(IssueRepository issueRepository) {
        this.issueRepository = issueRepository;
    }

    // Get all reported issues
    @GetMapping
    public List<Issue> getAllIssues() {
        return issueRepository.findAll();
    }

    // Submit a new issue
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Issue createIssue(@RequestBody Issue issue) {

        if (issue.getTitle() == null || issue.getTitle().isBlank()
                || issue.getDescription() == null || issue.getDescription().isBlank()
                || issue.getCategory() == null || issue.getCategory().isBlank()
                || issue.getLocation() == null || issue.getLocation().isBlank()) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Title, description, category, and location are required."
            );
        }

        issue.setId(null);
        issue.setStatus("PENDING");
        issue.setUserId(null);

        return issueRepository.save(issue);
    }

    // Update the status of an issue
    @PutMapping("/{id}/status")
    public Issue updateIssueStatus(
            @PathVariable Integer id,
            @RequestBody StatusUpdateRequest request) {

        Issue issue = issueRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Issue not found"
                ));

        String newStatus = request.status();

        if (newStatus == null
                || !(newStatus.equals("PENDING")
                || newStatus.equals("IN_PROGRESS")
                || newStatus.equals("RESOLVED"))) {

            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Status must be PENDING, IN_PROGRESS, or RESOLVED"
            );
        }

        issue.setStatus(newStatus);

        return issueRepository.save(issue);
    }

    // Request body for status updates
    public record StatusUpdateRequest(String status) {
    }
}
