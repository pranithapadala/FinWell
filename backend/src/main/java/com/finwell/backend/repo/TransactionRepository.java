package com.finwell.backend.repo;

import com.finwell.backend.model.Transaction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.time.LocalDate;
import java.util.List;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {

  List<Transaction> findByDateBetween(LocalDate start, LocalDate end);

  @Query("""
    SELECT t.category, SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE 0 END)
    FROM Transaction t
    WHERE t.date BETWEEN :start AND :end
    GROUP BY t.category
  """)
  List<Object[]> sumExpensesByCategory(LocalDate start, LocalDate end);
}
