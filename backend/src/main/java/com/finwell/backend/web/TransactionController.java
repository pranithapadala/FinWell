package com.finwell.backend.web;

import com.finwell.backend.model.Transaction;
import com.finwell.backend.repo.TransactionRepository;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/transactions")
@CrossOrigin(origins = "*")
public class TransactionController {

  private final TransactionRepository repo;

  public TransactionController(TransactionRepository repo) {
    this.repo = repo;
  }

  // GET /api/transactions?month=YYYY-MM
  @GetMapping
  public List<Transaction> list(@RequestParam String month) {
    LocalDate start = LocalDate.parse(month + "-01");
    LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
    return repo.findByDateBetween(start, end);
  }

  // POST /api/transactions
  @PostMapping
  public Transaction create(@RequestBody TxReq r) {
    Transaction t = new Transaction();
    t.setCategory(r.category());
    t.setNote(r.note());
    t.setAmount(r.amount());
    t.setDate(r.date());
    t.setType(r.type()); // "INCOME" or "EXPENSE"
    return repo.save(t);
  }

  // DELETE /api/transactions/{id}
  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable Long id) {
    if (!repo.existsById(id)) return ResponseEntity.notFound().build();
    repo.deleteById(id);
    return ResponseEntity.noContent().build();
  }

  // GET /api/transactions/summary?month=YYYY-MM
  @GetMapping("/summary")
  public Map<String, BigDecimal> summary(@RequestParam String month) {
    LocalDate start = LocalDate.parse(month + "-01");
    LocalDate end = start.withDayOfMonth(start.lengthOfMonth());
    Map<String, BigDecimal> out = new LinkedHashMap<>();
    for (Object[] row : repo.sumExpensesByCategory(start, end)) {
      out.put((String) row[0], (BigDecimal) row[1]);
    }
    return out;
  }

  // --- request body for POST ---
  public record TxReq(
    @NotBlank String category,
    String note,
    @NotNull BigDecimal amount,
    @NotNull LocalDate date,
    @NotBlank String type  // "INCOME" or "EXPENSE"
  ) {}
}
