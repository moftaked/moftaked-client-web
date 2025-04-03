import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-class-card',
  standalone: true,
  imports: [],
  templateUrl: './class-card.component.html',
  styleUrl: './class-card.component.scss'
})
export class ClassCardComponent {
  @Input() classId: number | undefined;
  @Input() name = '';
  @Output() clickedOnCard = new EventEmitter<number>();

  onClick() {
    this.clickedOnCard.emit(this.classId);
  }
}
