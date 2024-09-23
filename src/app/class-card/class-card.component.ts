import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-class-card',
  standalone: true,
  imports: [],
  templateUrl: './class-card.component.html',
  styleUrl: './class-card.component.css'
})
export class ClassCardComponent {
  @Input() classId = '';
  @Input() name = '';
  @Output() clickedOnCard = new EventEmitter<string>();

  onClick() {
    console.log('clicked on the card with classId: ' + this.classId);
    this.clickedOnCard.emit(this.classId);
  }
}
