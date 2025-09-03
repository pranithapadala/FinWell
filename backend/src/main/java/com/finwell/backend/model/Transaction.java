package com.finwell.backend.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "transactions") // <- MUST match your SQL table name
public class Transaction {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Long id;

  @Column(nullable = false)
  private String category;

  private String note;

  @Column(nullable = false)
  private BigDecimal amount;

  @Column(nullable = false)
  private LocalDate date;

  // Allowed values: "INCOME" or "EXPENSE"
  @Column(nullable = false)
  private String type;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  // --- getters/setters ---
  public Long getId() { return id; }

  public String getCategory() { return category; }
  public void setCategory(String category) { this.category = category; }

  public String getNote() { return note; }
  public void setNote(String note) { this.note = note; }

  public BigDecimal getAmount() { return amount; }
  public void setAmount(BigDecimal amount) { this.amount = amount; }

  public LocalDate getDate() { return date; }
  public void setDate(LocalDate date) { this.date = date; }

  public String getType() { return type; }
  public void setType(String type) { this.type = type; }

  public Instant getCreatedAt() { return createdAt; }
  public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
